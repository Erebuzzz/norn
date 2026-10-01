// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title NORNParticipantRegistry
 * @notice Maintains registry of autonomous agents, institutions, and services
 * participating in the NORN multilateral clearing and settlement network.
 */
contract NORNParticipantRegistry is AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant RISK_ADMIN_ROLE = keccak256("RISK_ADMIN_ROLE");

    enum ParticipantStatus {
        ACTIVE,
        CONSTRAINED,
        FROZEN
    }

    struct Participant {
        address participantAddress;
        ParticipantStatus status;
        uint256 settlementLimit;
        uint256 creditLimit;
        uint256 registeredAt;
        bool exists;
    }

    mapping(address => Participant) private _participants;
    address[] private _allParticipants;

    event ParticipantRegistered(address indexed participant, uint256 settlementLimit, uint256 creditLimit);
    event ParticipantStatusChanged(address indexed participant, ParticipantStatus oldStatus, ParticipantStatus newStatus);
    event ParticipantLimitsUpdated(address indexed participant, uint256 settlementLimit, uint256 creditLimit);
    event ParticipantFrozen(address indexed participant, string reason);
    event ParticipantUnfrozen(address indexed participant);

    error ParticipantAlreadyExists(address participant);
    error ParticipantNotFound(address participant);
    error InvalidAddress();
    error ParticipantIsFrozen(address participant);

    constructor(address admin) {
        if (admin == address(0)) revert InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(RISK_ADMIN_ROLE, admin);
    }

    function registerParticipant(
        address participant,
        uint256 settlementLimit,
        uint256 creditLimit
    ) external onlyRole(OPERATOR_ROLE) {
        if (participant == address(0)) revert InvalidAddress();
        if (_participants[participant].exists) revert ParticipantAlreadyExists(participant);

        _participants[participant] = Participant({
            participantAddress: participant,
            status: ParticipantStatus.ACTIVE,
            settlementLimit: settlementLimit,
            creditLimit: creditLimit,
            registeredAt: block.timestamp,
            exists: true
        });

        _allParticipants.push(participant);
        emit ParticipantRegistered(participant, settlementLimit, creditLimit);
    }

    function updateLimits(
        address participant,
        uint256 newSettlementLimit,
        uint256 newCreditLimit
    ) external onlyRole(RISK_ADMIN_ROLE) {
        if (!_participants[participant].exists) revert ParticipantNotFound(participant);
        _participants[participant].settlementLimit = newSettlementLimit;
        _participants[participant].creditLimit = newCreditLimit;

        emit ParticipantLimitsUpdated(participant, newSettlementLimit, newCreditLimit);
    }

    function freezeParticipant(address participant, string calldata reason) external onlyRole(RISK_ADMIN_ROLE) {
        if (!_participants[participant].exists) revert ParticipantNotFound(participant);
        ParticipantStatus oldStatus = _participants[participant].status;
        _participants[participant].status = ParticipantStatus.FROZEN;

        emit ParticipantStatusChanged(participant, oldStatus, ParticipantStatus.FROZEN);
        emit ParticipantFrozen(participant, reason);
    }

    function unfreezeParticipant(address participant) external onlyRole(RISK_ADMIN_ROLE) {
        if (!_participants[participant].exists) revert ParticipantNotFound(participant);
        ParticipantStatus oldStatus = _participants[participant].status;
        _participants[participant].status = ParticipantStatus.ACTIVE;

        emit ParticipantStatusChanged(participant, oldStatus, ParticipantStatus.ACTIVE);
        emit ParticipantUnfrozen(participant);
    }

    function setStatus(address participant, ParticipantStatus newStatus) external onlyRole(RISK_ADMIN_ROLE) {
        if (!_participants[participant].exists) revert ParticipantNotFound(participant);
        ParticipantStatus oldStatus = _participants[participant].status;
        _participants[participant].status = newStatus;

        emit ParticipantStatusChanged(participant, oldStatus, newStatus);
    }

    function getParticipant(address participant) external view returns (Participant memory) {
        if (!_participants[participant].exists) revert ParticipantNotFound(participant);
        return _participants[participant];
    }

    function isParticipantActive(address participant) external view returns (bool) {
        return _participants[participant].exists && _participants[participant].status == ParticipantStatus.ACTIVE;
    }

    function isParticipantFrozen(address participant) external view returns (bool) {
        return _participants[participant].exists && _participants[participant].status == ParticipantStatus.FROZEN;
    }

    function totalParticipants() external view returns (uint256) {
        return _allParticipants.length;
    }

    function getParticipantAtIndex(uint256 index) external view returns (address) {
        return _allParticipants[index];
    }
}
