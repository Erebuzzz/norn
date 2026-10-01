// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./RiskController.sol";
import "./NORNParticipantRegistry.sol";

/**
 * @title EmergencyController
 * @notice Provides circuit-breaker capabilities and emergency freezes under severe market shocks.
 */
contract EmergencyController is AccessControl {
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    RiskController public immutable riskController;
    NORNParticipantRegistry public immutable participantRegistry;

    event EmergencyTriggered(address indexed guardian, string reason);
    event EmergencyRecoveryInitiated(address indexed guardian);

    constructor(
        address admin,
        address riskControllerAddress,
        address participantRegistryAddress
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GUARDIAN_ROLE, admin);

        riskController = RiskController(riskControllerAddress);
        participantRegistry = NORNParticipantRegistry(participantRegistryAddress);
    }

    function triggerGlobalEmergency(string calldata reason) external onlyRole(GUARDIAN_ROLE) {
        riskController.setRegime(RiskController.RiskRegime.FROZEN, reason);
        emit EmergencyTriggered(msg.sender, reason);
    }

    function recoverToDefensive() external onlyRole(DEFAULT_ADMIN_ROLE) {
        riskController.setRegime(RiskController.RiskRegime.DEFENSIVE, "Recovery to DEFENSIVE mode");
        emit EmergencyRecoveryInitiated(msg.sender);
    }

    function recoverToNormal() external onlyRole(DEFAULT_ADMIN_ROLE) {
        riskController.setRegime(RiskController.RiskRegime.NORMAL, "Recovery to NORMAL mode");
        emit EmergencyRecoveryInitiated(msg.sender);
    }
}
