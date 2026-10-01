// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title RiskController
 * @notice Governs system-wide risk regimes and operational parameters
 * across NORN clearing and settlement cycles.
 */
contract RiskController is AccessControl {
    bytes32 public constant RISK_ADMIN_ROLE = keccak256("RISK_ADMIN_ROLE");
    bytes32 public constant MONITOR_ROLE = keccak256("MONITOR_ROLE");

    enum RiskRegime {
        NORMAL,
        CONSTRAINED,
        DEFENSIVE,
        FROZEN
    }

    RiskRegime public currentRegime;
    uint256 public lastRegimeChange;

    mapping(RiskRegime => uint256) public reserveRatioBps;

    event RiskRegimeChanged(RiskRegime indexed previousRegime, RiskRegime indexed newRegime, string reason);
    event ReserveRatioUpdated(RiskRegime indexed regime, uint256 ratioBps);

    error InvalidRatio();
    error IdenticalRegime();
    error SystemIsFrozen();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RISK_ADMIN_ROLE, admin);
        _grantRole(MONITOR_ROLE, admin);

        currentRegime = RiskRegime.NORMAL;
        lastRegimeChange = block.timestamp;

        reserveRatioBps[RiskRegime.NORMAL] = 1000;
        reserveRatioBps[RiskRegime.CONSTRAINED] = 2500;
        reserveRatioBps[RiskRegime.DEFENSIVE] = 5000;
        reserveRatioBps[RiskRegime.FROZEN] = 10000;
    }

    function setRegime(RiskRegime newRegime, string calldata reason) external {
        if (!hasRole(RISK_ADMIN_ROLE, msg.sender) && !hasRole(MONITOR_ROLE, msg.sender)) {
            revert AccessControlUnauthorizedAccount(msg.sender, RISK_ADMIN_ROLE);
        }
        if (currentRegime == newRegime) revert IdenticalRegime();

        RiskRegime previous = currentRegime;
        currentRegime = newRegime;
        lastRegimeChange = block.timestamp;

        emit RiskRegimeChanged(previous, newRegime, reason);
    }

    function setReserveRatio(RiskRegime regime, uint256 bps) external onlyRole(RISK_ADMIN_ROLE) {
        if (bps > 10000) revert InvalidRatio();
        reserveRatioBps[regime] = bps;
        emit ReserveRatioUpdated(regime, bps);
    }

    function getRequiredReserveRatio() external view returns (uint256) {
        return reserveRatioBps[currentRegime];
    }

    function isSettlementPermitted(uint8 priority) external view returns (bool) {
        if (currentRegime == RiskRegime.FROZEN) {
            return false;
        }
        if (currentRegime == RiskRegime.DEFENSIVE) {
            return priority == 0;
        }
        if (currentRegime == RiskRegime.CONSTRAINED) {
            return priority <= 1;
        }
        return true;
    }
}
