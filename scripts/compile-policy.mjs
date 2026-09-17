/**
 * Compile CreancePolicy.sol with solc → artifacts/CreancePolicy.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const solc = require('solc');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const contractPath = path.join(root, 'contracts', 'CreancePolicy.sol');
const outDir = path.join(root, 'artifacts');
const source = fs.readFileSync(contractPath, 'utf8');

function findImports(importPath) {
  const candidates = [
    path.join(root, 'node_modules', importPath),
    path.join(root, 'node_modules', '@openzeppelin/contracts', importPath.replace('@openzeppelin/contracts/', '')),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return { contents: fs.readFileSync(candidate, 'utf8') };
    }
  }
  // OZ flat resolution
  const oz = path.join(root, 'node_modules', importPath);
  if (fs.existsSync(oz)) return { contents: fs.readFileSync(oz, 'utf8') };
  return { error: `File not found: ${importPath}` };
}

const input = {
  language: 'Solidity',
  sources: {
    'CreancePolicy.sol': { content: source },
  },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: 'paris',
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'],
      },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

if (output.errors?.length) {
  const fatal = output.errors.filter((e) => e.severity === 'error');
  for (const err of output.errors) console.error(err.formattedMessage || err.message);
  if (fatal.length) process.exit(1);
}

const contract = output.contracts['CreancePolicy.sol']?.CreancePolicy;
if (!contract?.evm?.bytecode?.object) {
  console.error('Compile produced no bytecode');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
const artifact = {
  contractName: 'CreancePolicy',
  sourceName: 'contracts/CreancePolicy.sol',
  abi: contract.abi,
  bytecode: `0x${contract.evm.bytecode.object}`,
  deployedBytecode: `0x${contract.evm.deployedBytecode.object}`,
  compiledAt: new Date().toISOString(),
  compiler: { name: 'solc', version: solc.version() },
};

const outFile = path.join(outDir, 'CreancePolicy.json');
fs.writeFileSync(outFile, JSON.stringify(artifact, null, 2));
console.log(`Wrote ${outFile}`);
console.log(`Bytecode length: ${artifact.bytecode.length}`);
