# Creance policy contract

`CreancePolicy.sol` is the first on-chain counterpart to the deterministic Policy Officer. It is a gate and audit surface, not a token venue or custody layer.

| Off-chain check | Contract counterpart | Order |
| --- | --- | --- |
| Emergency depeg override | `depegRiskFromBps` and `depegRiskToBps` max check | Before normal policy |
| Per-asset ceiling | `assetCeilingSet`, `assetCeilingBps`, stablecoin exclusion | 1 |
| Aggregate equity ceiling | `equityAssets`, `projectedEquityWeightBps` | 2 |
| Safety floor | `safetyScore`, `mandate.riskFloor` | 3 |
| Post-trade liquidity | `projectedLiquidityUsd`, `mandate.liquidityFloorUsd` | 4 |
| Daily spend cap | `spentTodayUsd`, `intent.amountUsd`, day rollover | 5 |
| Human threshold | `humanApprovalThresholdUsd`, `pendingHumanApproval` | 6 |

The execution controller supplies post-trade measurements from its accounting layer. Before deployment, those values must be bound to verified on-chain balances or a separately authenticated oracle path. The contract intentionally does not accept a private key or perform asset transfers on behalf of an agent.

## Local verification

The contract was compile-checked locally with Solidity `0.8.24` before the compiler was removed from runtime and development dependencies. The repository currently verifies the matching off-chain behavior with `npm test`. Repeat Solidity compilation and add deployment tests as the next release gate once a Solidity toolchain and target network configuration are selected.
