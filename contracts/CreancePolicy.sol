// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CreancePolicy
/// @notice Deterministic policy gate for an external execution controller.
/// @dev This contract deliberately does not move tokens. It evaluates and
///      authorizes an intent, then lets a swappable executor perform the
///      venue-specific action. The check order mirrors src/agenticLoop.js.
contract CreancePolicy {
    uint256 private constant BPS = 10_000;

    bytes32 public constant CLEAR = "CLEAR";
    bytes32 public constant CAP_001 = "CAP_001";
    bytes32 public constant RISK_002 = "RISK_002";
    bytes32 public constant LIQ_003 = "LIQ_003";
    bytes32 public constant SPEND_004 = "SPEND_004";
    bytes32 public constant FREEZE_001 = "FREEZE_001";
    bytes32 public constant HUMAN_001 = "HUMAN_001";

    struct Mandate {
        uint256 equityCeilingBps;
        uint256 riskFloor;
        uint256 liquidityFloorUsd;
        uint256 dailySpendCapUsd;
        uint256 humanApprovalThresholdUsd;
        uint256 depegCriticalThresholdBps;
    }

    struct Intent {
        bytes32 id;
        address fromAsset;
        address toAsset;
        uint256 amountUsd;
        uint256 safetyScore;
        uint256 depegRiskFromBps;
        uint256 depegRiskToBps;
        uint256 projectedAssetWeightBps;
        uint256 projectedEquityWeightBps;
        uint256 projectedLiquidityUsd;
    }

    struct PolicyResult {
        bool permitted;
        bytes32 code;
        string reason;
        bool requiresHumanApproval;
    }

    address public owner;
    address public executor;
    Mandate public mandate;
    uint256 public spentTodayUsd;
    uint256 public spendingDay;

    mapping(address => bool) public stablecoins;
    mapping(address => bool) public equityAssets;
    mapping(address => bool) private assetCeilingSet;
    mapping(address => uint256) public assetCeilingBps;
    mapping(bytes32 => bool) public pendingHumanApproval;
    mapping(bytes32 => bool) public approvedIntents;

    event PolicyChecked(bytes32 indexed intentId, bytes32 indexed code, bool permitted, bool requiresHumanApproval);
    event ApprovalRequested(bytes32 indexed intentId);
    event ApprovalGranted(bytes32 indexed intentId);
    event ApprovalRejected(bytes32 indexed intentId, bytes32 indexed code);
    event TradeExecuted(bytes32 indexed intentId, address indexed fromAsset, address indexed toAsset, uint256 amountUsd);
    event MandateUpdated();
    event EmergencyFreeze(bytes32 indexed intentId, uint256 depegRiskBps);

    modifier onlyOwner() {
        require(msg.sender == owner, "OWNER_ONLY");
        _;
    }

    modifier onlyExecutor() {
        require(msg.sender == executor || msg.sender == owner, "EXECUTOR_ONLY");
        _;
    }

    constructor(address owner_, address executor_, Mandate memory initialMandate) {
        require(owner_ != address(0), "OWNER_ZERO");
        owner = owner_;
        executor = executor_;
        mandate = initialMandate;
        spendingDay = block.timestamp / 1 days;
    }

    function setExecutor(address executor_) external onlyOwner {
        require(executor_ != address(0), "EXECUTOR_ZERO");
        executor = executor_;
    }

    function setMandate(Mandate calldata nextMandate) external onlyOwner {
        require(nextMandate.equityCeilingBps <= BPS, "EQUITY_BPS");
        require(nextMandate.depegCriticalThresholdBps <= BPS, "DEPEG_BPS");
        mandate = nextMandate;
        emit MandateUpdated();
    }

    function classifyAsset(address asset, bool isStablecoin, bool isEquity) external onlyOwner {
        stablecoins[asset] = isStablecoin;
        equityAssets[asset] = isEquity;
    }

    function setAssetCeiling(address asset, uint256 ceilingBps, bool enabled) external onlyOwner {
        require(ceilingBps <= BPS, "ASSET_BPS");
        assetCeilingBps[asset] = ceilingBps;
        assetCeilingSet[asset] = enabled;
    }

    function resetDailySpend() external onlyOwner {
        spendingDay = block.timestamp / 1 days;
        spentTodayUsd = 0;
    }

    /// @notice Pure policy evaluation. The execution controller supplies
    /// post-trade measurements from its verified accounting layer.
    function evaluateIntent(Intent calldata intent) public view returns (PolicyResult memory) {
        uint256 depegRiskBps = intent.depegRiskFromBps > intent.depegRiskToBps
            ? intent.depegRiskFromBps
            : intent.depegRiskToBps;

        // Emergency override runs before every normal policy check.
        if (depegRiskBps >= mandate.depegCriticalThresholdBps) {
            return PolicyResult(false, FREEZE_001, "Critical depeg risk freezes new positions.", false);
        }

        // Check 1: explicit per-asset ceiling, never for a stablecoin destination.
        if (!stablecoins[intent.toAsset] && assetCeilingSet[intent.toAsset] && intent.projectedAssetWeightBps > assetCeilingBps[intent.toAsset]) {
            return PolicyResult(false, CAP_001, "Destination asset ceiling exceeded.", false);
        }

        // Check 2: aggregate equity ceiling, only for an equity destination.
        if (equityAssets[intent.toAsset] && intent.projectedEquityWeightBps > mandate.equityCeilingBps) {
            return PolicyResult(false, CAP_001, "Combined equity ceiling exceeded.", false);
        }

        // Check 3: safety score floor.
        if (intent.safetyScore < mandate.riskFloor) {
            return PolicyResult(false, RISK_002, "Safety score is below the mandate floor.", false);
        }

        // Check 4: post-trade liquidity. The caller must include received
        // stablecoin value when the destination is a stablecoin.
        if (intent.projectedLiquidityUsd < mandate.liquidityFloorUsd) {
            return PolicyResult(false, LIQ_003, "Post-trade liquidity is below the mandate floor.", false);
        }

        // Check 5: daily spend cap.
        uint256 activeDay = block.timestamp / 1 days;
        uint256 currentSpend = activeDay == spendingDay ? spentTodayUsd : 0;
        if (currentSpend + intent.amountUsd > mandate.dailySpendCapUsd) {
            return PolicyResult(false, SPEND_004, "Daily spend cap would be exceeded.", false);
        }

        // Check 6: human approval threshold.
        bool requiresHumanApproval = intent.amountUsd >= mandate.humanApprovalThresholdUsd;
        return PolicyResult(true, CLEAR, "All mandate constraints satisfied.", requiresHumanApproval);
    }

    /// @notice Records a policy decision and, when needed, opens the human
    /// approval state. It never performs the underlying asset transfer.
    function authorizeIntent(Intent calldata intent) external onlyExecutor returns (bool requiresHumanApproval) {
        PolicyResult memory result = evaluateIntent(intent);
        emit PolicyChecked(intent.id, result.code, result.permitted, result.requiresHumanApproval);
        if (!result.permitted) {
            if (result.code == FREEZE_001) emit EmergencyFreeze(intent.id, intent.depegRiskFromBps > intent.depegRiskToBps ? intent.depegRiskFromBps : intent.depegRiskToBps);
            emit ApprovalRejected(intent.id, result.code);
            revert(string.concat("POLICY:", _codeString(result.code)));
        }

        requiresHumanApproval = result.requiresHumanApproval;
        if (requiresHumanApproval) {
            pendingHumanApproval[intent.id] = true;
            emit ApprovalRequested(intent.id);
        } else {
            approvedIntents[intent.id] = true;
            emit ApprovalGranted(intent.id);
        }
    }

    function approveIntent(bytes32 intentId) external onlyOwner {
        require(pendingHumanApproval[intentId], "NO_PENDING_APPROVAL");
        pendingHumanApproval[intentId] = false;
        approvedIntents[intentId] = true;
        emit ApprovalGranted(intentId);
    }

    /// @notice Final gate immediately before a swappable executor acts.
    function markTradeExecuted(Intent calldata intent) external onlyExecutor {
        PolicyResult memory result = evaluateIntent(intent);
        emit PolicyChecked(intent.id, result.code, result.permitted, result.requiresHumanApproval);
        require(result.permitted, _codeString(result.code));
        require(approvedIntents[intent.id], "HUMAN_001");

        uint256 activeDay = block.timestamp / 1 days;
        if (activeDay != spendingDay) {
            spendingDay = activeDay;
            spentTodayUsd = 0;
        }
        spentTodayUsd += intent.amountUsd;
        approvedIntents[intent.id] = false;
        emit TradeExecuted(intent.id, intent.fromAsset, intent.toAsset, intent.amountUsd);
    }

    function _codeString(bytes32 code) private pure returns (string memory) {
        if (code == CLEAR) return "CLEAR";
        if (code == CAP_001) return "CAP_001";
        if (code == RISK_002) return "RISK_002";
        if (code == LIQ_003) return "LIQ_003";
        if (code == SPEND_004) return "SPEND_004";
        if (code == FREEZE_001) return "FREEZE_001";
        return "UNKNOWN";
    }
}
