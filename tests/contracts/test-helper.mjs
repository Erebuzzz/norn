import fs from "fs";
import path from "path";
import ganache from "ganache";
import {
  createPublicClient,
  createWalletClient,
  custom,
  parseEther,
  keccak256,
  encodePacked,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactsDir = path.resolve(__dirname, "../../artifacts");

export function loadArtifact(contractName) {
  const file = path.join(artifactsDir, `${contractName}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Artifact not found: ${file}. Run node scripts/compile-contracts.mjs first.`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export async function setupTestEnvironment() {
  const provider = ganache.provider({
    wallet: {
      totalAccounts: 10,
      defaultBalance: 1000,
    },
    logging: { quiet: true },
    chain: { chainId: 31337 },
  });

  const publicClient = createPublicClient({
    transport: custom(provider),
  });

  const accounts = provider.getInitialAccounts();
  const accountAddresses = Object.keys(accounts);

  const adminAccount = {
    address: accountAddresses[0],
    privateKey: accounts[accountAddresses[0]].secretKey,
  };
  const payerAccount = {
    address: accountAddresses[1],
    privateKey: accounts[accountAddresses[1]].secretKey,
  };
  const payeeAccount = {
    address: accountAddresses[2],
    privateKey: accounts[accountAddresses[2]].secretKey,
  };
  const solverAccount = {
    address: accountAddresses[3],
    privateKey: accounts[accountAddresses[3]].secretKey,
  };

  const adminClient = createWalletClient({
    account: privateKeyToAccount(adminAccount.privateKey),
    transport: custom(provider),
  });

  const payerClient = createWalletClient({
    account: privateKeyToAccount(payerAccount.privateKey),
    transport: custom(provider),
  });

  const payeeClient = createWalletClient({
    account: privateKeyToAccount(payeeAccount.privateKey),
    transport: custom(provider),
  });

  const solverClient = createWalletClient({
    account: privateKeyToAccount(solverAccount.privateKey),
    transport: custom(provider),
  });

  return {
    provider,
    publicClient,
    adminClient,
    payerClient,
    payeeClient,
    solverClient,
    adminAccount,
    payerAccount,
    payeeAccount,
    solverAccount,
  };
}
