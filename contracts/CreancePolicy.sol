// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title CreancePolicy
/// @notice On-chain mandate gate for an autonomous treasury cell.
/// @dev Does not custody or move tokens. Evaluates intents, records decisions
///      with explainable codes, and gates execution. Mirrors src/agenticLoop.js.
///      Ownable (OZ) is the owner plane; ZeroDev session keys are the executor plane.
contract CreancePolicy is Ownable {
    uint256 private constant BPS = 10_000;

    bytes32 public constant CLEAR = "CLEAR";
    bytes32 public constant CAP_001 = "CAP_001";
    bytes32 public constant RISK_002 = "RISK_002";
    bytes32 public constant LIQ_003 = "LIQ_003";
    bytes32 public constant SPEND_004 = "SPEND_004";
    bytes32 public constant YIELD_005 = "YIELD_005";
    bytes32 public constant FREEZE_001 = "FREEZE_001";
    bytes32 public constant HUMAN_001 = "HUMAN_001";
    bytes32 public constant ROLE_REVOKED = "ROLE_REVOKED";

    bytes32 public constant ROLE_REBALANCE = "REBALANCE";
    bytes32 public constant ROLE_YIELD = "YIELD";
    bytes32 public constant ROLE_PAY = "PAY";

    struct Mandate {
        uint256 equityCeilingBps;
        uint256 yieldCeilingBps;
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
        uint256 projectedYieldWeightBps;
        uint256 projectedLiquidityUsd;
    }

    struct PolicyResult {
        bool permitted;
        bytes32 code;
        string reason;
        bool requiresHumanApproval;
    }

    struct Delegate {
        bool active;
        bytes32 role;
        uint256 spendLimitUsd;
        uint256 spentUsd;
        uint256 expiresAt;
    }

    address public executor;
    Mandate public mandate;
    uint256 public spentTodayUsd;
    uint256 public spendingDay;
    bool public frozen;

    mapping(address => bool) public stablecoins;
    mapping(address => bool) public equityAssets;
    mapping(address => bool) public yieldAssets;
    mapping(address => bool) private assetCeilingSet;
    mapping(address => uint256) public assetCeilingBps;
    mapping(bytes32 => bool) public pendingHumanApproval;
    mapping(bytes32 => bool) public approvedIntents;
    mapping(address => Delegate) public delegates;

    event ProposalCreated(bytes32 indexed intentId, address fromAsset, address toAsset, uint256 amountUsd);
    event PolicyChecked(bytes32 indexed intentId, bytes32 indexed code, bool permitted, bool requiresHumanApproval, string reason);
    event ApprovalRequested(bytes32 indexed intentId);
    event ApprovalGranted(bytes32 indexed intentId);
    event ApprovalRejected(bytes32 indexed intentId, bytes32 indexed code);
    event TradeExecuted(bytes32 indexed intentId, address indexed fromAsset, address indexed toAsset, uint256 amountUsd);
    event MandateUpdated(uint256 equityCeilingBps, uint256 yieldCeilingBps, uint256 riskFloor);
    event EmergencyFreeze(bytes32 indexed intentId, uint256 depegRiskBps);
    event DelegateGranted(address indexed who, bytes32 role, uint256 spendLimitUsd, uint256 expiresAt);
    event DelegateRevoked(address indexed who, bytes32 role);

    modifier onlyExecutor() {
        require(msg.sender == executor || msg.sender == owner(), "EXECUTOR_ONLY");
        _;
    }

    constructor(address owner_, address executor_, Mandate memory initialMandate) Ownable(owner_) {
        require(executor_ != address(0), "EXECUTOR_ZERO");
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
        require(nextMandate.yieldCeilingBps <= BPS, "YIELD_BPS");
        require(nextMandate.depegCriticalThresholdBps <= BPS, "DEPEG_BPS");
        mandate = nextMandate;
        emit MandateUpdated(nextMandate.equityCeilingBps, nextMandate.yieldCeilingBps, nextMandate.riskFloor);
    }

    function classifyAsset(address asset, bool isStablecoin, bool isEquity, bool isYield) external onlyOwner {
        stablecoins[asset] = isStablecoin;
        equityAssets[asset] = isEquity;
        yieldAssets[asset] = isYield;
    }

    function setAssetCeiling(address asset, uint256 ceilingBps, bool enabled) external onlyOwner {
        require(ceilingBps <= BPS, "ASSET_BPS");
        assetCeilingBps[asset] = ceilingBps;
        assetCeilingSet[asset] = enabled;
    }

    function grantDelegate(address who, bytes32 role, uint256 spendLimitUsd, uint256 ttlSeconds) external onlyOwner {
        require(who != address(0), "DELEGATE_ZERO");
        uint256 expiresAt = block.timestamp + ttlSeconds;
        delegates[who] = Delegate(true, role, spendLimitUsd, 0, expiresAt);
        emit DelegateGranted(who, role, spendLimitUsd, expiresAt);
    }

    /// @notice Instantly kills delegated authority. Owner-only; no agent path.
    function revokeDelegate(address who) external onlyOwner {
        Delegate memory d = delegates[who];
        require(d.active, "NO_DELEGATE");
        delete delegates[who];
        emit DelegateRevoked(who, d.role);
    }

    function resetDailySpend() external onlyOwner {
        spendingDay = block.timestamp / 1 days;
        spentTodayUsd = 0;
    }

    function clearFreeze() external onlyOwner {
        frozen = false;
    }

    function evaluateIntent(Intent calldata intent) public view returns (PolicyResult memory) {
        if (frozen) {
            return PolicyResult(false, FREEZE_001, "Treasury is frozen by emergency override.", false);
        }

        uint256 depegRiskBps = intent.depegRiskFromBps > intent.depegRiskToBps
            ? intent.depegRiskFromBps
            : intent.depegRiskToBps;

        if (depegRiskBps >= mandate.depegCriticalThresholdBps) {
            return PolicyResult(false, FREEZE_001, "Critical depeg risk freezes new positions.", false);
        }

        if (!stablecoins[intent.toAsset] && assetCeilingSet[intent.toAsset] && intent.projectedAssetWeightBps > assetCeilingBps[intent.toAsset]) {
            return PolicyResult(false, CAP_001, "Destination asset ceiling exceeded.", false);
        }

        if (equityAssets[intent.toAsset] && intent.projectedEquityWeightBps > mandate.equityCeilingBps) {
            return PolicyResult(false, CAP_001, "Combined equity ceiling exceeded.", false);
        }

        if (yieldAssets[intent.toAsset] && intent.projectedYieldWeightBps > mandate.yieldCeilingBps) {
            return PolicyResult(false, YIELD_005, "Yield venue exposure would exceed the mandate ceiling.", false);
        }

        if (intent.safetyScore < mandate.riskFloor) {
            return PolicyResult(false, RISK_002, "Safety score is below the mandate floor.", false);
        }

        if (intent.projectedLiquidityUsd < mandate.liquidityFloorUsd) {
            return PolicyResult(false, LIQ_003, "Post-trade liquidity is below the mandate floor.", false);
        }

        uint256 activeDay = block.timestamp / 1 days;
        uint256 currentSpend = activeDay == spendingDay ? spentTodayUsd : 0;
        if (currentSpend + intent.amountUsd > mandate.dailySpendCapUsd) {
            return PolicyResult(false, SPEND_004, "Daily spend cap would be exceeded.", false);
        }

        bool requiresHumanApproval = intent.amountUsd >= mandate.humanApprovalThresholdUsd;
        return PolicyResult(true, CLEAR, "All mandate constraints satisfied.", requiresHumanApproval);
    }

    /// @notice Records a policy decision on-chain without reverting on reject.
    /// @dev Prefer this for product UX so every reject still has a tx hash
    ///      and PolicyChecked / ApprovalRejected events are queryable.
    function submitDecision(Intent calldata intent)
        external
        onlyExecutor
        returns (bool permitted, bytes32 code, bool requiresHumanApproval)
    {
        return _recordDecision(intent);
    }

    /// @notice Strict path: reverts with POLICY:<code> when rejected.
    function authorizeIntent(Intent calldata intent) external onlyExecutor returns (bool requiresHumanApproval) {
        (bool permitted, bytes32 code, bool needsHuman) = _recordDecision(intent);
        if (!permitted) revert(string.concat("POLICY:", _codeString(code)));
        return needsHuman;
    }

    function _recordDecision(Intent calldata intent)
        private
        returns (bool permitted, bytes32 code, bool requiresHumanApproval)
    {
        emit ProposalCreated(intent.id, intent.fromAsset, intent.toAsset, intent.amountUsd);
        PolicyResult memory result = evaluateIntent(intent);
        emit PolicyChecked(intent.id, result.code, result.permitted, result.requiresHumanApproval, result.reason);

        if (!result.permitted) {
            if (result.code == FREEZE_001) {
                frozen = true;
                emit EmergencyFreeze(
                    intent.id,
                    intent.depegRiskFromBps > intent.depegRiskToBps ? intent.depegRiskFromBps : intent.depegRiskToBps
                );
            }
            emit ApprovalRejected(intent.id, result.code);
            return (false, result.code, false);
        }

        if (result.requiresHumanApproval) {
            pendingHumanApproval[intent.id] = true;
            emit ApprovalRequested(intent.id);
        } else {
            approvedIntents[intent.id] = true;
            emit ApprovalGranted(intent.id);
        }
        return (true, result.code, result.requiresHumanApproval);
    }

    function approveIntent(bytes32 intentId) external onlyOwner {
        require(pendingHumanApproval[intentId], "NO_PENDING_APPROVAL");
        pendingHumanApproval[intentId] = false;
        approvedIntents[intentId] = true;
        emit ApprovalGranted(intentId);
    }

    function markTradeExecuted(Intent calldata intent) external onlyExecutor {
        require(!frozen, "FROZEN");
        PolicyResult memory result = evaluateIntent(intent);
        emit PolicyChecked(intent.id, result.code, result.permitted, result.requiresHumanApproval, result.reason);
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
        if (code == YIELD_005) return "YIELD_005";
        if (code == FREEZE_001) return "FREEZE_001";
        if (code == ROLE_REVOKED) return "ROLE_REVOKED";
        return "UNKNOWN";
    }
}
