import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_CHAIN_CONFIG,
  robinhoodTestnet,
  ROBINHOOD_DOCS,
  STOCK_TOKEN_SECURITY_GUIDANCE,
  CANONICAL_STOCK_TOKENS,
  CANONICAL_SETTLEMENT_ASSETS,
  MOCK_SETTLEMENT_ASSETS,
  isCanonicalStockTokenAddress,
  getCanonicalStockTokenBySymbol,
  getCanonicalStockTokenByAddress,
  verifyCanonicalStockToken,
  StockTokenReader,
  StalePriceError,
  InvalidPriceError,
  DEFAULT_COLLATERAL_ASSUMPTIONS,
  calculateEffectiveCollateral,
  calculateCollateralFromToken,
  USDGAdapter,
  USDCAdapter,
  MockUSDGAdapter,
  MockUSDCAdapter,
  assertProductionSettlementAsset,
  isSettlementAssetMock,
  ProductionAssetSafetyError,
  InsufficientBalanceError,
} from "../../packages/robinhood/dist/index.js";

describe("Robinhood Chain & USDG Integration Suite", () => {
  describe("Robinhood Chain Configuration & Security Rules", () => {
    test("Chain Parameters: matches Robinhood Chain specifications and Chain ID 46630", () => {
      assert.equal(ROBINHOOD_CHAIN_ID, 46630);
      assert.equal(ROBINHOOD_CHAIN_CONFIG.chainId, 46630);
      assert.equal(ROBINHOOD_CHAIN_CONFIG.chainName, "Robinhood Chain Testnet");
      assert.equal(ROBINHOOD_CHAIN_CONFIG.nativeCurrency.symbol, "ETH");
      assert.equal(ROBINHOOD_CHAIN_CONFIG.nativeCurrency.decimals, 18);
      assert.ok(ROBINHOOD_CHAIN_CONFIG.rpcUrls.default.includes("robinhood.com"));
      assert.equal(robinhoodTestnet.id, 46630);
      assert.equal(robinhoodTestnet.name, "Robinhood Chain Testnet");
    });

    test("Documentation References: contains verified official Robinhood Chain documentation links", () => {
      assert.equal(ROBINHOOD_DOCS.overview, "https://docs.robinhood.com/chain/");
      assert.equal(ROBINHOOD_DOCS.connecting, "https://docs.robinhood.com/chain/connecting/");
      assert.equal(ROBINHOOD_DOCS.deploySmartContracts, "https://docs.robinhood.com/chain/deploy-smart-contracts/");
      assert.equal(ROBINHOOD_DOCS.contracts, "https://docs.robinhood.com/chain/contracts/");
      assert.equal(ROBINHOOD_DOCS.stockTokens, "https://docs.robinhood.com/chain/stock-tokens/");
      assert.equal(ROBINHOOD_DOCS.stockTokenApis, "https://docs.robinhood.com/chain/stock-token-apis/");
    });

    test("Security Guidance: requires canonical contract address verification rather than trusting tickers", () => {
      assert.equal(
        STOCK_TOKEN_SECURITY_GUIDANCE.rule,
        "Distinguish canonical contract addresses rather than trusting ticker or name alone."
      );
      assert.ok(STOCK_TOKEN_SECURITY_GUIDANCE.warning.includes("arbitrary ticker symbols"));
      assert.ok(STOCK_TOKEN_SECURITY_GUIDANCE.recommendations.length >= 3);
    });

    test("Canonical Stock Tokens: exposes vetted addresses for HOOD, AAPL, NVDA, TSLA, MSFT", () => {
      const requiredSymbols = ["HOOD", "AAPL", "NVDA", "TSLA", "MSFT"];
      for (const symbol of requiredSymbols) {
        const token = CANONICAL_STOCK_TOKENS[symbol];
        assert.ok(token, `Canonical map must contain ${symbol}`);
        assert.equal(token.symbol, symbol);
        assert.match(token.address, /^0x[0-9a-fA-F]{40}$/);
        assert.match(token.oracleAddress, /^0x[0-9a-fA-F]{40}$/);
        assert.equal(token.decimals, 18);
        assert.ok(token.issuer.length > 0);
      }
    });

    test("Canonical Verification: validates genuine tokens and rejects counterfeit address spoofs", () => {
      const genuineAapl = CANONICAL_STOCK_TOKENS.AAPL.address;
      const spoofedAapl = "0xBadBadBadBadBadBadBadBadBadBadBadBadBad1";

      assert.equal(isCanonicalStockTokenAddress(genuineAapl), true);
      assert.equal(isCanonicalStockTokenAddress(spoofedAapl), false);

      assert.equal(verifyCanonicalStockToken("AAPL", genuineAapl), true);
      assert.equal(verifyCanonicalStockToken("AAPL", spoofedAapl), false);

      const found = getCanonicalStockTokenBySymbol("HOOD");
      assert.equal(found?.symbol, "HOOD");
      assert.equal(getCanonicalStockTokenBySymbol("NON_EXISTENT"), undefined);

      const foundByAddr = getCanonicalStockTokenByAddress(CANONICAL_STOCK_TOKENS.NVDA.address);
      assert.equal(foundByAddr?.symbol, "NVDA");
    });
  });

  describe("StockTokenReader & Oracle Integration", () => {
    test("StockTokenReader: reads canonical token info and observed price in 1e6 fixed point", async () => {
      const reader = new StockTokenReader();
      const hoodAddress = CANONICAL_STOCK_TOKENS.HOOD.address;

      const tokenInfo = await reader.readTokenInfo(hoodAddress);
      assert.equal(tokenInfo.symbol, "HOOD");
      assert.equal(tokenInfo.address.toLowerCase(), hoodAddress.toLowerCase());
      assert.equal(tokenInfo.decimals, 18);
      assert.equal(tokenInfo.chainId, ROBINHOOD_CHAIN_ID);
      assert.equal(tokenInfo.tradingStatus, "OPEN");
      assert.equal(tokenInfo.isCanonical, true);
      assert.equal(tokenInfo.observedPriceUsd, 38_500_000n); // $38.50 in 1e6 fixed point
    });

    test("StockTokenReader: observes market status updates across states (OPEN, AFTER_HOURS, HALTED, CLOSED)", async () => {
      const reader = new StockTokenReader();
      const aaplAddress = CANONICAL_STOCK_TOKENS.AAPL.address;

      // Status 1: OPEN
      let status = await reader.getTradingStatus(aaplAddress);
      assert.equal(status, "OPEN");

      // Status 2: AFTER_HOURS
      reader.updatePriceAndStatus(aaplAddress, 225_000_000n, "AFTER_HOURS");
      status = await reader.getTradingStatus(aaplAddress);
      assert.equal(status, "AFTER_HOURS");

      // Status 3: HALTED
      reader.updatePriceAndStatus(aaplAddress, 225_000_000n, "HALTED");
      status = await reader.getTradingStatus(aaplAddress);
      assert.equal(status, "HALTED");

      // Status 4: CLOSED
      reader.updatePriceAndStatus(aaplAddress, 225_000_000n, "CLOSED");
      status = await reader.getTradingStatus(aaplAddress);
      assert.equal(status, "CLOSED");
    });

    test("Staleness Guard: rejects prices exceeding max allowed staleness window", async () => {
      let mockClock = 1_000_000;
      const reader = new StockTokenReader({
        maxStalenessSeconds: 300,
        currentTimeProvider: () => mockClock,
      });

      const nvdaAddress = CANONICAL_STOCK_TOKENS.NVDA.address;

      // Price updated at t=1,000,000
      reader.updatePriceAndStatus(nvdaAddress, 125_750_000n, "OPEN", 1_000_000);

      // Read at t=1,000,200 (200 seconds later, within 300s window)
      mockClock = 1_000_200;
      const validRead = await reader.readPrice(nvdaAddress);
      assert.equal(validRead.priceUsd, 125_750_000n);

      // Advance clock to t=1,000,301 (301 seconds later, exceeds 300s window)
      mockClock = 1_000_301;
      await assert.rejects(
        async () => {
          await reader.readPrice(nvdaAddress);
        },
        (err) => {
          assert.ok(err instanceof StalePriceError);
          assert.ok(err.message.includes("is stale"));
          return true;
        }
      );
    });

    test("Invalid Price Guard: rejects zero or negative oracle price answers", async () => {
      const reader = new StockTokenReader();
      const tslaAddress = CANONICAL_STOCK_TOKENS.TSLA.address;

      // Zero price injection
      reader.updatePriceAndStatus(tslaAddress, 0n, "OPEN");
      await assert.rejects(
        async () => {
          await reader.readPrice(tslaAddress);
        },
        (err) => {
          assert.ok(err instanceof InvalidPriceError);
          assert.ok(err.message.includes("Invalid oracle price"));
          return true;
        }
      );

      // Negative price injection
      reader.updatePriceAndStatus(tslaAddress, -500n, "OPEN");
      await assert.rejects(
        async () => {
          await reader.readPrice(tslaAddress);
        },
        (err) => {
          assert.ok(err instanceof InvalidPriceError);
          return true;
        }
      );
    });

    test("Strict Canonical Mode: blocks reading unverified tokens when enabled", async () => {
      const reader = new StockTokenReader({ strictCanonical: true });
      const spoofedAddress = "0xBadBadBadBadBadBadBadBadBadBadBadBadBad2";

      await assert.rejects(
        async () => {
          await reader.readTokenInfo(spoofedAddress);
        },
        (err) => {
          assert.ok(err.message.includes("Security restriction"));
          return true;
        }
      );
    });
  });

  describe("Section 18 Stock Token Collateral Evaluation", () => {
    test("Protocol Defaults: Haircut 20% (0.80), LiquidityFactor 90% (0.90), State Factors calibrated", () => {
      assert.equal(DEFAULT_COLLATERAL_ASSUMPTIONS.haircutMultiplierBps, 8_000n);
      assert.equal(DEFAULT_COLLATERAL_ASSUMPTIONS.liquidityFactorBps, 9_000n);
      assert.equal(DEFAULT_COLLATERAL_ASSUMPTIONS.stateFactorsBps.OPEN, 10_000n);
      assert.equal(DEFAULT_COLLATERAL_ASSUMPTIONS.stateFactorsBps.AFTER_HOURS, 5_000n);
      assert.equal(DEFAULT_COLLATERAL_ASSUMPTIONS.stateFactorsBps.HALTED, 0n);
      assert.equal(DEFAULT_COLLATERAL_ASSUMPTIONS.stateFactorsBps.CLOSED, 0n);
      assert.equal(DEFAULT_COLLATERAL_ASSUMPTIONS.maxSettlementCapacityUsd, 100_000_000_000n);
    });

    test("Section 18 Baseline Example: $20,000 market value across market states", () => {
      // $20,000 in 1e6 fixed point = 20_000_000_000n
      const marketValue = 20_000_000_000n;

      // 1. OPEN state:
      // EffectiveCollateral = 20,000 * 0.80 * 0.90 * 1.0 = $14,400 (14_400_000_000n)
      const openResult = calculateEffectiveCollateral({
        marketValueUsd: marketValue,
        tradingStatus: "OPEN",
      });
      assert.equal(openResult.effectiveCollateralUsd, 14_400_000_000n);
      assert.equal(openResult.haircutMultiplier, 0.8);
      assert.equal(openResult.liquidityFactor, 0.9);
      assert.equal(openResult.stateFactor, 1.0);
      assert.equal(openResult.isCapped, false);

      // 2. AFTER_HOURS state:
      // EffectiveCollateral = 20,000 * 0.80 * 0.90 * 0.5 = $7,200 (7_200_000_000n)
      const afterHoursResult = calculateEffectiveCollateral({
        marketValueUsd: marketValue,
        tradingStatus: "AFTER_HOURS",
      });
      assert.equal(afterHoursResult.effectiveCollateralUsd, 7_200_000_000n);
      assert.equal(afterHoursResult.stateFactor, 0.5);

      // 3. HALTED state: strictly $0
      const haltedResult = calculateEffectiveCollateral({
        marketValueUsd: marketValue,
        tradingStatus: "HALTED",
      });
      assert.equal(haltedResult.effectiveCollateralUsd, 0n);
      assert.equal(haltedResult.stateFactor, 0.0);

      // 4. CLOSED state: strictly $0
      const closedResult = calculateEffectiveCollateral({
        marketValueUsd: marketValue,
        tradingStatus: "CLOSED",
      });
      assert.equal(closedResult.effectiveCollateralUsd, 0n);
      assert.equal(closedResult.stateFactor, 0.0);
    });

    test("Section 18 Illustration with Custom State Factor: 20% haircut, 90% liquidity, 90% state factor yields $12,960", () => {
      // Section 18 text example: 20000 * 0.80 * 0.90 * 0.90 = $12,960
      const customResult = calculateEffectiveCollateral({
        marketValueUsd: 20_000_000_000n,
        tradingStatus: "OPEN",
        customParameters: {
          haircutMultiplierBps: 8_000n,
          liquidityFactorBps: 9_000n,
          stateFactorsBps: {
            OPEN: 9_000n, // 90% state factor
            AFTER_HOURS: 4_500n,
            HALTED: 0n,
            CLOSED: 0n,
          },
        },
      });
      assert.equal(customResult.effectiveCollateralUsd, 12_960_000_000n);
      assert.equal(customResult.breakdown.postHaircutValueUsd, 16_000_000_000n);
      assert.equal(customResult.breakdown.postLiquidityValueUsd, 14_400_000_000n);
      assert.equal(customResult.breakdown.stateFactorAppliedUsd, 12_960_000_000n);
    });

    test("Bounded Risk: effective collateral never exceeds market value and respects settlement capacity cap", () => {
      // 1. Never exceeds market value even if multipliers were 100%
      const boundaryResult = calculateEffectiveCollateral({
        marketValueUsd: 10_000_000_000n,
        tradingStatus: "OPEN",
        customParameters: {
          haircutMultiplierBps: 10_000n,
          liquidityFactorBps: 10_000n,
        },
      });
      assert.ok(boundaryResult.effectiveCollateralUsd <= 10_000_000_000n);

      // 2. Settlement capacity cap enforcement:
      // Market value $500,000 -> raw effective $360,000, capped at $100,000 cap
      const largePosition = calculateEffectiveCollateral({
        marketValueUsd: 500_000_000_000n,
        tradingStatus: "OPEN",
        customParameters: {
          maxSettlementCapacityUsd: 100_000_000_000n,
        },
      });
      assert.equal(largePosition.effectiveCollateralUsd, 100_000_000_000n);
      assert.equal(largePosition.isCapped, true);
    });

    test("Token-to-Collateral Computation: calculates effective collateral from base token amounts and decimals", () => {
      // 100 HOOD tokens with 18 decimals, price = $38.50 (38_500_000n in 1e6 fixed point)
      // Market value = 100 * 38.50 = $3,850.00 (3_850_000_000n)
      // OPEN effective collateral = 3,850 * 0.80 * 0.90 * 1.0 = $2,772.00 (2_772_000_000n)
      const tokenResult = calculateCollateralFromToken({
        tokenAmount: 100n * 10n ** 18n,
        tokenDecimals: 18,
        priceUsd: 38_500_000n,
        tradingStatus: "OPEN",
      });
      assert.equal(tokenResult.marketValueUsd, 3_850_000_000n);
      assert.equal(tokenResult.effectiveCollateralUsd, 2_772_000_000n);
    });
  });

  describe("Section 19 Settlement Asset Adapters (USDG & USDC)", () => {
    test("Canonical USDG Adapter: models Paxos USDG token with 6 decimals and real status", () => {
      const usdg = new USDGAdapter();
      assert.equal(usdg.symbol(), "USDG");
      assert.equal(usdg.decimals(), 6);
      assert.equal(usdg.isMock(), false);
      assert.equal(usdg.address().toLowerCase(), CANONICAL_SETTLEMENT_ASSETS.USDG.address.toLowerCase());
    });

    test("Canonical USDC Adapter: models Circle USDC token with 6 decimals and real status", () => {
      const usdc = new USDCAdapter();
      assert.equal(usdc.symbol(), "USDC");
      assert.equal(usdc.decimals(), 6);
      assert.equal(usdc.isMock(), false);
      assert.equal(usdc.address().toLowerCase(), CANONICAL_SETTLEMENT_ASSETS.USDC.address.toLowerCase());
    });

    test("Testnet Mock USDG: clearly labeled TESTNET_MOCK_USDG and never masquerades as actual USDG", () => {
      const mockUsdg = new MockUSDGAdapter();
      assert.equal(mockUsdg.symbol(), "TESTNET_MOCK_USDG");
      assert.equal(mockUsdg.isMock(), true);
      assert.equal(mockUsdg.decimals(), 6);
      assert.ok(mockUsdg.getLabel().includes("NOT ACTUAL USDG"));
      assert.equal(isSettlementAssetMock(mockUsdg), true);
    });

    test("Testnet Mock USDC: clearly labeled TESTNET_MOCK_USDC and never masquerades as actual USDC", () => {
      const mockUsdc = new MockUSDCAdapter();
      assert.equal(mockUsdc.symbol(), "TESTNET_MOCK_USDC");
      assert.equal(mockUsdc.isMock(), true);
      assert.equal(mockUsdc.decimals(), 6);
      assert.ok(mockUsdc.getLabel().includes("NOT ACTUAL USDC"));
      assert.equal(isSettlementAssetMock(mockUsdc), true);
    });

    test("Mock Asset Operations: supports minting, balance tracking, transfers, and prevents overdraft", async () => {
      const sender = "0x1234567890123456789012345678901234567890";
      const recipient = "0x9876543210987654321098765432109876543210";
      const adapter = new MockUSDGAdapter(MOCK_SETTLEMENT_ASSETS.TESTNET_MOCK_USDG.address, sender);

      // Initial balance zero
      assert.equal(await adapter.balanceOf(sender), 0n);
      assert.equal(await adapter.balanceOf(recipient), 0n);

      // Mint 50,000 USDG units ($50.00 with 6 decimals)
      adapter.mint(sender, 50_000_000n);
      assert.equal(await adapter.balanceOf(sender), 50_000_000n);

      // Execute transfer of 20,000 USDG units
      const txHash = await adapter.transfer(recipient, 20_000_000n);
      assert.match(txHash, /^0x[0-9a-fA-F]{64}$/);
      assert.equal(await adapter.balanceOf(sender), 30_000_000n);
      assert.equal(await adapter.balanceOf(recipient), 20_000_000n);

      // Attempt overdraft transfer of 35,000 units (sender only has 30,000)
      await assert.rejects(
        async () => {
          await adapter.transfer(recipient, 35_000_000n);
        },
        (err) => {
          assert.ok(err instanceof InsufficientBalanceError);
          assert.ok(err.message.includes("Insufficient balance"));
          return true;
        }
      );
    });

    test("Production Safety Guard: blocks mock assets from entering production settlement pipelines", () => {
      const canonicalUsdg = new USDGAdapter();
      const canonicalUsdc = new USDCAdapter();
      const mockUsdg = new MockUSDGAdapter();
      const mockUsdc = new MockUSDCAdapter();

      // Canonical adapters pass safety verification
      assert.doesNotThrow(() => {
        assertProductionSettlementAsset(canonicalUsdg);
      });
      assert.doesNotThrow(() => {
        assertProductionSettlementAsset(canonicalUsdc);
      });

      // Mock adapters are strictly rejected
      assert.throws(
        () => {
          assertProductionSettlementAsset(mockUsdg);
        },
        (err) => {
          assert.ok(err instanceof ProductionAssetSafetyError);
          assert.ok(err.message.includes("cannot be used in production settlement"));
          return true;
        }
      );

      assert.throws(
        () => {
          assertProductionSettlementAsset(mockUsdc);
        },
        (err) => {
          assert.ok(err instanceof ProductionAssetSafetyError);
          return true;
        }
      );
    });
  });
});
