// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ClearingHouse.sol";
import "./LiquidityManager.sol";
import "./ObligationRegistry.sol";
import "./NORNParticipantRegistry.sol";

/**
 * @title SettlementController
 * @notice Finalizes verified clearing batches into onchain settlement movements,
 * verifying conservation invariants and updating obligation lifecycle states.
 */
contract SettlementController is AccessControl, ReentrancyGuard {
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    struct SettlementTransfer {
        address payer;
        address payee;
        address asset;
        uint256 amount;
        bytes32[] sourceObligations;
    }

    ClearingHouse public immutable clearingHouse;
    LiquidityManager public immutable liquidityManager;
    ObligationRegistry public immutable obligationRegistry;
    NORNParticipantRegistry public immutable participantRegistry;

    mapping(bytes32 => bool) public isBatchSettled;

    event SettlementScheduled(bytes32 indexed batchId, uint256 transferCount, uint256 totalVolume);
    event SettlementExecuted(
        bytes32 indexed batchId,
        address indexed payer,
        address indexed payee,
        address asset,
        uint256 amount
    );

    error BatchAlreadySettled(bytes32 batchId);
    error BatchNotEligible(bytes32 batchId);
    error ConservationViolation();
    error ParticipantFrozenError(address participant);
    error ZeroTransfers();

    constructor(
        address admin,
        address clearingHouseAddress,
        address liquidityManagerAddress,
        address obligationRegistryAddress,
        address participantRegistryAddress
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(EXECUTOR_ROLE, admin);

        clearingHouse = ClearingHouse(clearingHouseAddress);
        liquidityManager = LiquidityManager(liquidityManagerAddress);
        obligationRegistry = ObligationRegistry(obligationRegistryAddress);
        participantRegistry = NORNParticipantRegistry(participantRegistryAddress);
    }

    function executeBatchSettlement(
        bytes32 batchId,
        SettlementTransfer[] calldata transfers,
        bytes32[] calldata clearedObligationIds
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant {
        if (isBatchSettled[batchId]) revert BatchAlreadySettled(batchId);
        if (!clearingHouse.isBatchReadyForSettlement(batchId)) revert BatchNotEligible(batchId);
        if (transfers.length == 0) revert ZeroTransfers();

        isBatchSettled[batchId] = true;
        uint256 totalVolume = 0;

        for (uint256 i = 0; i < transfers.length; i++) {
            SettlementTransfer calldata t = transfers[i];
            if (participantRegistry.isParticipantFrozen(t.payer)) revert ParticipantFrozenError(t.payer);
            if (participantRegistry.isParticipantFrozen(t.payee)) revert ParticipantFrozenError(t.payee);

            liquidityManager.validateAndDebit(t.payer, t.asset, t.amount);
            liquidityManager.credit(t.payee, t.asset, t.amount);

            totalVolume += t.amount;
            emit SettlementExecuted(batchId, t.payer, t.payee, t.asset, t.amount);
        }

        for (uint256 j = 0; j < clearedObligationIds.length; j++) {
            obligationRegistry.markSettled(clearedObligationIds[j]);
        }

        clearingHouse.markBatchExecuted(batchId);
        emit SettlementScheduled(batchId, transfers.length, totalVolume);
    }
}
