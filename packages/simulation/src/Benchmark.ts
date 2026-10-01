import type { BenchmarkMetrics, SimulationModeResult } from "./types.js";

export class Benchmark {
  static compute(
    modeA: SimulationModeResult,
    modeB: SimulationModeResult,
    modeC: SimulationModeResult
  ): BenchmarkMetrics {
    const grossVolume = modeA.grossObligationVolume;
    const grossCount = modeA.grossObligationCount;

    // TransferCompression = 1 - (Transfers_NORN / Transfers_Immediate)
    const transferCompression =
      modeA.transferCount > 0
        ? 1 - modeC.transferCount / modeA.transferCount
        : 0;

    // LiquidityReduction = 1 - (PeakLiquidity_NORN / PeakLiquidity_Immediate)
    const immediatePeak = Number(modeA.peakLiquidityRequired);
    const nornPeak = Number(modeC.peakLiquidityRequired);
    const liquidityReduction =
      immediatePeak > 0 ? 1 - nornPeak / immediatePeak : 0;

    // GrossToNetRatio = GrossObligations / NetSettlementVolume
    const netVol = Number(modeC.settlementVolume);
    const grossVol = Number(grossVolume);
    const grossToNetRatio = netVol > 0 ? grossVol / netVol : 1;

    // Bilateral transfer compression for comparison
    const bilateralTransferCompression =
      modeA.transferCount > 0
        ? 1 - modeB.transferCount / modeA.transferCount
        : 0;

    return {
      grossObligationVolume: grossVolume,
      grossObligationCount: grossCount,
      immediateSettlementVolume: modeA.settlementVolume,
      immediateTransferCount: modeA.transferCount,
      immediatePeakLiquidity: modeA.peakLiquidityRequired,
      bilateralSettlementVolume: modeB.settlementVolume,
      bilateralTransferCount: modeB.transferCount,
      bilateralPeakLiquidity: modeB.peakLiquidityRequired,
      nornSettlementVolume: modeC.settlementVolume,
      nornTransferCount: modeC.transferCount,
      nornPeakLiquidity: modeC.peakLiquidityRequired,
      transferCompression,
      liquidityReduction,
      grossToNetRatio,
      bilateralTransferCompression,
    };
  }

  static formatReport(metrics: BenchmarkMetrics): string {
    const formatUnits = (val: bigint) => (Number(val) / 1e6).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    });

    const lines = [
      "============================================================",
      "                 NORN EFFICIENCY BENCHMARK",
      "============================================================",
      `Total Obligations:          ${metrics.grossObligationCount.toLocaleString()}`,
      `Gross Obligation Volume:    ${formatUnits(metrics.grossObligationVolume)}`,
      "------------------------------------------------------------",
      "COMPARATIVE SETTLEMENT METRICS:",
      `Mode A (Immediate RTGS):`,
      `  Transfers:                ${metrics.immediateTransferCount.toLocaleString()}`,
      `  Settlement Volume:        ${formatUnits(metrics.immediateSettlementVolume)}`,
      `  Peak Liquidity Demand:    ${formatUnits(metrics.immediatePeakLiquidity)}`,
      "",
      `Mode B (Bilateral Batch):`,
      `  Transfers:                ${metrics.bilateralTransferCount.toLocaleString()}`,
      `  Settlement Volume:        ${formatUnits(metrics.bilateralSettlementVolume)}`,
      `  Peak Liquidity Demand:    ${formatUnits(metrics.bilateralPeakLiquidity)}`,
      `  Transfer Compression:     ${(metrics.bilateralTransferCompression * 100).toFixed(2)}%`,
      "",
      `Mode C (NORN Multilateral):`,
      `  Transfers:                ${metrics.nornTransferCount.toLocaleString()}`,
      `  Net Settlement Volume:    ${formatUnits(metrics.nornSettlementVolume)}`,
      `  Peak Liquidity Demand:    ${formatUnits(metrics.nornPeakLiquidity)}`,
      "------------------------------------------------------------",
      "CORE BENCHMARK INDICATORS:",
      `Transfer Compression:      ${(metrics.transferCompression * 100).toFixed(2)}%`,
      `Liquidity Reduction:       ${(metrics.liquidityReduction * 100).toFixed(2)}%`,
      `Gross-to-Net Ratio:        ${metrics.grossToNetRatio.toFixed(2)}x`,
      "============================================================",
    ];

    return lines.join("\n");
  }
}
