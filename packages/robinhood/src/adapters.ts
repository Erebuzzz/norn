import {
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
  getAddress,
  keccak256,
  stringToBytes,
  parseAbi,
} from "viem";
import {
  CANONICAL_SETTLEMENT_ASSETS,
  MOCK_SETTLEMENT_ASSETS,
} from "./config.js";

export interface SettlementAssetAdapter {
  symbol(): string;
  address(): Address;
  decimals(): number;
  balanceOf(account: Address): Promise<bigint>;
  transfer(to: Address, amount: bigint): Promise<Hash>;
  isMock(): boolean;
}

const ERC20_ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);

export interface RealAdapterOptions {
  contractAddress?: Address;
  publicClient?: PublicClient;
  walletClient?: WalletClient;
  account?: Address;
}

export class ProductionAssetSafetyError extends Error {
  constructor(symbol: string) {
    super(
      `Production settlement safety violation: Mock asset ${symbol} cannot be used in production settlement.`
    );
    this.name = "ProductionAssetSafetyError";
  }
}

export class InsufficientBalanceError extends Error {
  constructor(account: Address, requested: bigint, available: bigint) {
    super(
      `Insufficient balance for account ${account}. Requested: ${requested}, Available: ${available}`
    );
    this.name = "InsufficientBalanceError";
  }
}

abstract class BaseLiveAdapter implements SettlementAssetAdapter {
  protected readonly contractAddress: Address;
  protected readonly publicClient?: PublicClient;
  protected readonly walletClient?: WalletClient;
  protected readonly defaultAccount?: Address;
  protected localBalances: Map<string, bigint> = new Map();

  constructor(options: RealAdapterOptions, defaultAddress: Address) {
    this.contractAddress = getAddress(options.contractAddress ?? defaultAddress);
    this.publicClient = options.publicClient;
    this.walletClient = options.walletClient;
    this.defaultAccount = options.account;
  }

  public abstract symbol(): string;
  public abstract decimals(): number;

  public address(): Address {
    return this.contractAddress;
  }

  public isMock(): boolean {
    return false;
  }

  public async balanceOf(account: Address): Promise<bigint> {
    const normalized = account.toLowerCase();
    if (this.publicClient) {
      try {
        const balance = await this.publicClient.readContract({
          address: this.contractAddress,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [account],
        });
        return BigInt(balance);
      } catch {
        // Fall back to local balance if contract read fails in sandbox/dry-run
        return this.localBalances.get(normalized) ?? 0n;
      }
    }
    return this.localBalances.get(normalized) ?? 0n;
  }

  public async transfer(to: Address, amount: bigint): Promise<Hash> {
    if (amount <= 0n) {
      throw new Error("Transfer amount must be greater than zero.");
    }

    if (this.walletClient && this.defaultAccount) {
      const hash = await this.walletClient.writeContract({
        address: this.contractAddress,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [to, amount],
        account: this.defaultAccount,
        chain: undefined,
      });
      return hash;
    }

    // In-memory execution fallback for dry-run or mock RPC environments
    const sender = this.defaultAccount ?? ("0x1111111111111111111111111111111111111111" as Address);
    const senderNorm = sender.toLowerCase();
    const toNorm = to.toLowerCase();
    const currentSenderBal = this.localBalances.get(senderNorm) ?? 0n;

    if (currentSenderBal < amount) {
      throw new InsufficientBalanceError(sender, amount, currentSenderBal);
    }

    this.localBalances.set(senderNorm, currentSenderBal - amount);
    const currentToBal = this.localBalances.get(toNorm) ?? 0n;
    this.localBalances.set(toNorm, currentToBal + amount);

    const entropy = `${senderNorm}-${toNorm}-${amount.toString()}-${Date.now()}`;
    return keccak256(stringToBytes(entropy));
  }

  public setLocalBalance(account: Address, amount: bigint): void {
    this.localBalances.set(account.toLowerCase(), amount);
  }
}

export class USDGAdapter extends BaseLiveAdapter {
  constructor(options: RealAdapterOptions = {}) {
    super(options, CANONICAL_SETTLEMENT_ASSETS.USDG.address);
  }

  public symbol(): string {
    return "USDG";
  }

  public decimals(): number {
    return 6;
  }
}

export class USDCAdapter extends BaseLiveAdapter {
  constructor(options: RealAdapterOptions = {}) {
    super(options, CANONICAL_SETTLEMENT_ASSETS.USDC.address);
  }

  public symbol(): string {
    return "USDC";
  }

  public decimals(): number {
    return 6;
  }
}

abstract class BaseMockAdapter implements SettlementAssetAdapter {
  protected readonly contractAddress: Address;
  protected readonly balances: Map<string, bigint> = new Map();
  protected readonly defaultSender?: Address;
  private txCounter: bigint = 0n;

  constructor(address: Address, defaultSender?: Address) {
    this.contractAddress = getAddress(address);
    this.defaultSender = defaultSender;
  }

  public abstract symbol(): string;
  public abstract getLabel(): string;

  public decimals(): number {
    return 6;
  }

  public address(): Address {
    return this.contractAddress;
  }

  public isMock(): boolean {
    return true;
  }

  public async balanceOf(account: Address): Promise<bigint> {
    return this.balances.get(account.toLowerCase()) ?? 0n;
  }

  public async transfer(to: Address, amount: bigint): Promise<Hash> {
    if (amount <= 0n) {
      throw new Error("Transfer amount must be greater than zero.");
    }

    const sender = this.defaultSender ?? ("0x9999999999999999999999999999999999999999" as Address);
    const senderKey = sender.toLowerCase();
    const toKey = to.toLowerCase();
    const senderBal = this.balances.get(senderKey) ?? 0n;

    if (senderBal < amount) {
      throw new InsufficientBalanceError(sender, amount, senderBal);
    }

    this.balances.set(senderKey, senderBal - amount);
    const toBal = this.balances.get(toKey) ?? 0n;
    this.balances.set(toKey, toBal + amount);

    this.txCounter += 1n;
    const entropy = `MOCK_TX:${this.symbol()}:${senderKey}:${toKey}:${amount}:${this.txCounter}`;
    return keccak256(stringToBytes(entropy));
  }

  public mint(to: Address, amount: bigint): void {
    const key = to.toLowerCase();
    const current = this.balances.get(key) ?? 0n;
    this.balances.set(key, current + amount);
  }

  public setBalance(account: Address, amount: bigint): void {
    this.balances.set(account.toLowerCase(), amount);
  }
}

export class MockUSDGAdapter extends BaseMockAdapter {
  public static readonly LABEL =
    "TESTNET_MOCK_USDG (TEST-ONLY FALLBACK - NOT ACTUAL USDG)";

  constructor(
    address: Address = MOCK_SETTLEMENT_ASSETS.TESTNET_MOCK_USDG.address,
    defaultSender?: Address
  ) {
    super(address, defaultSender);
  }

  public symbol(): string {
    return "TESTNET_MOCK_USDG";
  }

  public getLabel(): string {
    return MockUSDGAdapter.LABEL;
  }
}

export class MockUSDCAdapter extends BaseMockAdapter {
  public static readonly LABEL =
    "TESTNET_MOCK_USDC (TEST-ONLY FALLBACK - NOT ACTUAL USDC)";

  constructor(
    address: Address = MOCK_SETTLEMENT_ASSETS.TESTNET_MOCK_USDC.address,
    defaultSender?: Address
  ) {
    super(address, defaultSender);
  }

  public symbol(): string {
    return "TESTNET_MOCK_USDC";
  }

  public getLabel(): string {
    return MockUSDCAdapter.LABEL;
  }
}

export function assertProductionSettlementAsset(
  adapter: SettlementAssetAdapter
): void {
  if (adapter.isMock()) {
    throw new ProductionAssetSafetyError(adapter.symbol());
  }

  const symbol = adapter.symbol().toUpperCase();
  if (symbol.includes("MOCK") || symbol.includes("TESTNET")) {
    throw new ProductionAssetSafetyError(adapter.symbol());
  }
}

export function isSettlementAssetMock(
  adapter: SettlementAssetAdapter
): boolean {
  return adapter.isMock();
}
