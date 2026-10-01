// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./NORNParticipantRegistry.sol";

/**
 * @title ObligationRegistry
 * @notice Validates, registers, and tracks cryptographically signed economic obligations
 * adhering to EIP-712 structured data signing.
 */
contract ObligationRegistry is EIP712, AccessControl {
    using ECDSA for bytes32;

    bytes32 public constant CLEARING_HOUSE_ROLE = keccak256("CLEARING_HOUSE_ROLE");
    bytes32 public constant SETTLEMENT_ROLE = keccak256("SETTLEMENT_ROLE");

    bytes32 public constant OBLIGATION_TYPEHASH = keccak256(
        "Obligation(bytes32 id,address payer,address payee,address asset,uint256 amount,uint256 nonce,uint256 expiresAt,uint8 priority,bytes32 referenceHash)"
    );

    enum ObligationPriority {
        CRITICAL,
        HIGH,
        NORMAL,
        NETTABLE,
        DEFERRED
    }

    enum ObligationStatus {
        NONE,
        CREATED,
        ACCEPTED,
        CLEARED,
        SETTLED,
        REJECTED,
        EXPIRED,
        CANCELLED
    }

    struct ObligationParams {
        bytes32 id;
        address payer;
        address payee;
        address asset;
        uint256 amount;
        uint256 nonce;
        uint256 expiresAt;
        ObligationPriority priority;
        bytes32 referenceHash;
    }

    struct Obligation {
        bytes32 id;
        address payer;
        address payee;
        address asset;
        uint256 amount;
        uint256 nonce;
        uint256 createdAt;
        uint256 expiresAt;
        ObligationPriority priority;
        bytes32 referenceHash;
        ObligationStatus status;
    }

    NORNParticipantRegistry public immutable participantRegistry;

    mapping(bytes32 => Obligation) private _obligations;
    mapping(address => mapping(uint256 => bool)) private _usedNonces;

    event ObligationCreated(
        bytes32 indexed id,
        address indexed payer,
        address indexed payee,
        address asset,
        uint256 amount,
        uint8 priority,
        uint256 expiresAt
    );
    event ObligationStatusChanged(bytes32 indexed id, ObligationStatus oldStatus, ObligationStatus newStatus);
    event ObligationCancelled(bytes32 indexed id, address indexed sender);

    error InvalidPayer();
    error InvalidPayee();
    error IdenticalParties();
    error InvalidAsset();
    error ZeroAmount();
    error ObligationExpiredError(uint256 expiresAt, uint256 currentTimestamp);
    error NonceAlreadyUsed(address payer, uint256 nonce);
    error InvalidSignature();
    error ObligationAlreadyExists(bytes32 id);
    error ObligationNotFound(bytes32 id);
    error InvalidStatusTransition(ObligationStatus currentStatus, ObligationStatus targetStatus);
    error PayerFrozen(address payer);
    error PayeeFrozen(address payee);

    constructor(
        address admin,
        address participantRegistryAddress
    ) EIP712("NORN Obligation Protocol", "1") {
        if (admin == address(0) || participantRegistryAddress == address(0)) revert InvalidPayer();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        participantRegistry = NORNParticipantRegistry(participantRegistryAddress);
    }

    function hashObligation(ObligationParams calldata params) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    OBLIGATION_TYPEHASH,
                    params.id,
                    params.payer,
                    params.payee,
                    params.asset,
                    params.amount,
                    params.nonce,
                    params.expiresAt,
                    uint8(params.priority),
                    params.referenceHash
                )
            )
        );
    }

    function submitObligation(
        ObligationParams calldata params,
        bytes calldata signature
    ) external returns (bytes32) {
        if (params.payer == address(0)) revert InvalidPayer();
        if (params.payee == address(0)) revert InvalidPayee();
        if (params.payer == params.payee) revert IdenticalParties();
        if (params.asset == address(0)) revert InvalidAsset();
        if (params.amount == 0) revert ZeroAmount();
        if (params.expiresAt <= block.timestamp) revert ObligationExpiredError(params.expiresAt, block.timestamp);
        if (_usedNonces[params.payer][params.nonce]) revert NonceAlreadyUsed(params.payer, params.nonce);
        if (_obligations[params.id].status != ObligationStatus.NONE) revert ObligationAlreadyExists(params.id);

        if (participantRegistry.isParticipantFrozen(params.payer)) revert PayerFrozen(params.payer);
        if (participantRegistry.isParticipantFrozen(params.payee)) revert PayeeFrozen(params.payee);

        bytes32 structHash = hashObligation(params);
        address recoveredSigner = structHash.recover(signature);
        if (recoveredSigner != params.payer) revert InvalidSignature();

        _usedNonces[params.payer][params.nonce] = true;

        Obligation storage ob = _obligations[params.id];
        ob.id = params.id;
        ob.payer = params.payer;
        ob.payee = params.payee;
        ob.asset = params.asset;
        ob.amount = params.amount;
        ob.nonce = params.nonce;
        ob.createdAt = block.timestamp;
        ob.expiresAt = params.expiresAt;
        ob.priority = params.priority;
        ob.referenceHash = params.referenceHash;
        ob.status = ObligationStatus.ACCEPTED;

        emit ObligationCreated(params.id, params.payer, params.payee, params.asset, params.amount, uint8(params.priority), params.expiresAt);
        emit ObligationStatusChanged(params.id, ObligationStatus.NONE, ObligationStatus.ACCEPTED);

        return params.id;
    }

    function markCleared(bytes32 id) external onlyRole(CLEARING_HOUSE_ROLE) {
        Obligation storage ob = _obligations[id];
        if (ob.status == ObligationStatus.NONE) revert ObligationNotFound(id);
        if (ob.status != ObligationStatus.ACCEPTED) {
            revert InvalidStatusTransition(ob.status, ObligationStatus.CLEARED);
        }

        ob.status = ObligationStatus.CLEARED;
        emit ObligationStatusChanged(id, ObligationStatus.ACCEPTED, ObligationStatus.CLEARED);
    }

    function markSettled(bytes32 id) external onlyRole(SETTLEMENT_ROLE) {
        Obligation storage ob = _obligations[id];
        if (ob.status == ObligationStatus.NONE) revert ObligationNotFound(id);
        if (ob.status != ObligationStatus.CLEARED && ob.status != ObligationStatus.ACCEPTED) {
            revert InvalidStatusTransition(ob.status, ObligationStatus.SETTLED);
        }

        ob.status = ObligationStatus.SETTLED;
        emit ObligationStatusChanged(id, ob.status, ObligationStatus.SETTLED);
    }

    function cancelObligation(bytes32 id) external {
        Obligation storage ob = _obligations[id];
        if (ob.status == ObligationStatus.NONE) revert ObligationNotFound(id);
        if (msg.sender != ob.payer && msg.sender != ob.payee && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert InvalidPayer();
        }
        if (ob.status != ObligationStatus.ACCEPTED && ob.status != ObligationStatus.CREATED) {
            revert InvalidStatusTransition(ob.status, ObligationStatus.CANCELLED);
        }

        ObligationStatus prev = ob.status;
        ob.status = ObligationStatus.CANCELLED;
        emit ObligationStatusChanged(id, prev, ObligationStatus.CANCELLED);
        emit ObligationCancelled(id, msg.sender);
    }

    function getObligation(bytes32 id) external view returns (Obligation memory) {
        if (_obligations[id].status == ObligationStatus.NONE) revert ObligationNotFound(id);
        return _obligations[id];
    }

    function isNonceUsed(address payer, uint256 nonce) external view returns (bool) {
        return _usedNonces[payer][nonce];
    }
}
