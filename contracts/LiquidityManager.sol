// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./RiskController.sol";

/**
 * @title LiquidityManager
 * @notice Manages participant deposited liquidity, reservation queues, and ensures
 * solvency invariants before any net settlement can execute.
 */
contract LiquidityManager is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant SETTLEMENT_CONTROLLER_ROLE = keccak256("SETTLEMENT_CONTROLLER_ROLE");
    bytes32 public constant CLEARING_HOUSE_ROLE = keccak256("CLEARING_HOUSE_ROLE");

    struct ParticipantLiquidity {
        uint256 deposited;
        uint256 reserved;
    }

    RiskController public immutable riskController;

    mapping(address => mapping(address => ParticipantLiquidity)) private _liquidity;

    event LiquidityDeposited(address indexed participant, address indexed asset, uint256 amount);
    event LiquidityWithdrawn(address indexed participant, address indexed asset, uint256 amount);
    event LiquidityReserved(address indexed participant, address indexed asset, uint256 amount);
    event LiquidityReleased(address indexed participant, address indexed asset, uint256 amount);

    error InsufficientAvailableLiquidity(uint256 available, uint256 requested);
    error InsufficientReservedLiquidity(uint256 reserved, uint256 released);
    error PostSettlementReserveBreach(
        uint256 availableLiquidity,
        uint256 debitAmount,
        uint256 requiredReserve,
        uint256 shortfall
    );
    error ZeroAmount();
    error InvalidAddress();

    constructor(address admin, address riskControllerAddress) {
        if (admin == address(0) || riskControllerAddress == address(0)) revert InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        riskController = RiskController(riskControllerAddress);
    }

    function deposit(address asset, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (asset == address(0)) revert InvalidAddress();

        _liquidity[msg.sender][asset].deposited += amount;
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);

        emit LiquidityDeposited(msg.sender, asset, amount);
    }

    function withdraw(address asset, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        ParticipantLiquidity storage pl = _liquidity[msg.sender][asset];
        uint256 available = pl.deposited > pl.reserved ? pl.deposited - pl.reserved : 0;
        if (amount > available) revert InsufficientAvailableLiquidity(available, amount);

        pl.deposited -= amount;
        IERC20(asset).safeTransfer(msg.sender, amount);

        emit LiquidityWithdrawn(msg.sender, asset, amount);
    }

    function reserve(
        address participant,
        address asset,
        uint256 amount
    ) external onlyRole(CLEARING_HOUSE_ROLE) {
        ParticipantLiquidity storage pl = _liquidity[participant][asset];
        uint256 available = pl.deposited > pl.reserved ? pl.deposited - pl.reserved : 0;
        if (amount > available) revert InsufficientAvailableLiquidity(available, amount);

        pl.reserved += amount;
        emit LiquidityReserved(participant, asset, amount);
    }

    function release(
        address participant,
        address asset,
        uint256 amount
    ) external onlyRole(CLEARING_HOUSE_ROLE) {
        ParticipantLiquidity storage pl = _liquidity[participant][asset];
        if (amount > pl.reserved) revert InsufficientReservedLiquidity(pl.reserved, amount);

        pl.reserved -= amount;
        emit LiquidityReleased(participant, asset, amount);
    }

    function validateAndDebit(
        address participant,
        address asset,
        uint256 debitAmount
    ) external onlyRole(SETTLEMENT_CONTROLLER_ROLE) {
        ParticipantLiquidity storage pl = _liquidity[participant][asset];
        uint256 total = pl.deposited;
        uint256 reserved = pl.reserved;
        uint256 available = total > reserved ? total - reserved : 0;

        if (debitAmount > available) {
            revert InsufficientAvailableLiquidity(available, debitAmount);
        }

        uint256 ratioBps = riskController.getRequiredReserveRatio();
        uint256 requiredReserve = (total * ratioBps) / 10000;
        uint256 postLiquidity = available - debitAmount;

        if (postLiquidity < requiredReserve) {
            uint256 shortfall = requiredReserve - postLiquidity;
            revert PostSettlementReserveBreach(available, debitAmount, requiredReserve, shortfall);
        }

        pl.deposited -= debitAmount;
    }

    function credit(
        address participant,
        address asset,
        uint256 creditAmount
    ) external onlyRole(SETTLEMENT_CONTROLLER_ROLE) {
        _liquidity[participant][asset].deposited += creditAmount;
    }

    function getLiquidityState(address participant, address asset)
        external
        view
        returns (
            uint256 total,
            uint256 reserved,
            uint256 available,
            uint256 requiredReserve
        )
    {
        ParticipantLiquidity storage pl = _liquidity[participant][asset];
        total = pl.deposited;
        reserved = pl.reserved;
        available = total > reserved ? total - reserved : 0;
        uint256 ratioBps = riskController.getRequiredReserveRatio();
        requiredReserve = (total * ratioBps) / 10000;
    }
}
