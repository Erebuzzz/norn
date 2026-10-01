// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./NORNParticipantRegistry.sol";
import "./ObligationRegistry.sol";

/**
 * @title ClearingHouse
 * @notice Coordinates clearing epochs, collects Merkle commitments for multilateral
 * obligation graphs and net positions, and authorises settlement execution.
 */
contract ClearingHouse is AccessControl {
    bytes32 public constant SOLVER_ROLE = keccak256("SOLVER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    enum BatchStatus {
        NONE,
        COMMITTED,
        CHALLENGED,
        FINALIZED,
        EXECUTED
    }

    struct ClearingBatch {
        bytes32 batchId;
        uint256 epoch;
        bytes32 obligationRoot;
        bytes32 participantNetRoot;
        bytes32 settlementRoot;
        uint256 createdAt;
        uint256 validUntil;
        address solver;
        BatchStatus status;
    }

    uint256 public currentEpoch;
    mapping(uint256 => bytes32) public epochBatch;
    mapping(bytes32 => ClearingBatch) private _batches;

    event ClearingEpochOpened(uint256 indexed epoch, uint256 timestamp);
    event ClearingBatchCommitted(
        bytes32 indexed batchId,
        uint256 indexed epoch,
        address indexed solver,
        bytes32 obligationRoot,
        bytes32 participantNetRoot,
        bytes32 settlementRoot,
        uint256 validUntil
    );
    event ClearingBatchFinalized(bytes32 indexed batchId, uint256 indexed epoch);
    event ClearingBatchChallenged(bytes32 indexed batchId, address indexed challenger, string reason);
    event ClearingBatchExecuted(bytes32 indexed batchId);

    error EpochAlreadyCommitted(uint256 epoch);
    error InvalidBatchId();
    error InvalidRoots();
    error InvalidExpiry();
    error BatchNotFound(bytes32 batchId);
    error BatchNotFinalized(bytes32 batchId);
    error BatchExpired(bytes32 batchId);
    error InvalidBatchStatus(BatchStatus current, BatchStatus expected);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(SOLVER_ROLE, admin);
        currentEpoch = 1;
        emit ClearingEpochOpened(1, block.timestamp);
    }

    function openNextEpoch() external onlyRole(OPERATOR_ROLE) returns (uint256) {
        currentEpoch += 1;
        emit ClearingEpochOpened(currentEpoch, block.timestamp);
        return currentEpoch;
    }

    function commitBatch(
        uint256 epoch,
        bytes32 batchId,
        bytes32 obligationRoot,
        bytes32 participantNetRoot,
        bytes32 settlementRoot,
        uint256 validUntil
    ) external onlyRole(SOLVER_ROLE) {
        if (batchId == bytes32(0)) revert InvalidBatchId();
        if (obligationRoot == bytes32(0) || participantNetRoot == bytes32(0) || settlementRoot == bytes32(0)) {
            revert InvalidRoots();
        }
        if (validUntil <= block.timestamp) revert InvalidExpiry();
        if (_batches[batchId].status != BatchStatus.NONE) revert InvalidBatchId();
        if (epochBatch[epoch] != bytes32(0)) revert EpochAlreadyCommitted(epoch);

        _batches[batchId] = ClearingBatch({
            batchId: batchId,
            epoch: epoch,
            obligationRoot: obligationRoot,
            participantNetRoot: participantNetRoot,
            settlementRoot: settlementRoot,
            createdAt: block.timestamp,
            validUntil: validUntil,
            solver: msg.sender,
            status: BatchStatus.FINALIZED
        });

        epochBatch[epoch] = batchId;

        emit ClearingBatchCommitted(
            batchId,
            epoch,
            msg.sender,
            obligationRoot,
            participantNetRoot,
            settlementRoot,
            validUntil
        );
        emit ClearingBatchFinalized(batchId, epoch);
    }

    function markBatchExecuted(bytes32 batchId) external onlyRole(OPERATOR_ROLE) {
        ClearingBatch storage batch = _batches[batchId];
        if (batch.status == BatchStatus.NONE) revert BatchNotFound(batchId);
        if (batch.status != BatchStatus.FINALIZED) {
            revert InvalidBatchStatus(batch.status, BatchStatus.FINALIZED);
        }
        if (block.timestamp > batch.validUntil) revert BatchExpired(batchId);

        batch.status = BatchStatus.EXECUTED;
        emit ClearingBatchExecuted(batchId);
    }

    function getBatch(bytes32 batchId) external view returns (ClearingBatch memory) {
        if (_batches[batchId].status == BatchStatus.NONE) revert BatchNotFound(batchId);
        return _batches[batchId];
    }

    function isBatchReadyForSettlement(bytes32 batchId) external view returns (bool) {
        ClearingBatch memory b = _batches[batchId];
        return b.status == BatchStatus.FINALIZED && block.timestamp <= b.validUntil;
    }
}
