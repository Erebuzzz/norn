import fs from "fs";
import path from "path";
import solc from "solc";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const contractsDir = path.join(rootDir, "contracts");
const artifactsDir = path.join(rootDir, "artifacts");

function findSolFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      findSolFiles(filePath, fileList);
    } else if (file.endsWith(".sol")) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const solFiles = findSolFiles(contractsDir);
console.log(`Found ${solFiles.length} Solidity files to compile.`);

const sources = {};
for (const file of solFiles) {
  const relPath = path.relative(rootDir, file).replace(/\\/g, "/");
  sources[relPath] = {
    content: fs.readFileSync(file, "utf8"),
  };
}

function findImports(importPath) {
  try {
    let resolvedPath;
    if (importPath.startsWith("@openzeppelin/")) {
      resolvedPath = path.join(rootDir, "node_modules", importPath);
    } else if (importPath.startsWith("./") || importPath.startsWith("../")) {
      resolvedPath = path.resolve(contractsDir, importPath);
    } else {
      resolvedPath = path.join(rootDir, "node_modules", importPath);
    }

    if (fs.existsSync(resolvedPath)) {
      return { contents: fs.readFileSync(resolvedPath, "utf8") };
    }
    return { error: `File not found: ${importPath} (checked ${resolvedPath})` };
  } catch (err) {
    return { error: err.message };
  }
}

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
    evmVersion: "cancun",
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode", "evm.deployedBytecode"],
      },
    },
  },
};

console.log("Compiling contracts with solc 0.8.24...");
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

if (output.errors) {
  let hasError = false;
  for (const err of output.errors) {
    if (err.severity === "error") {
      hasError = true;
      console.error("ERROR:", err.formattedMessage);
    } else {
      console.warn("WARNING:", err.formattedMessage);
    }
  }
  if (hasError) {
    process.exit(1);
  }
}

if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}

let count = 0;
for (const [sourcePath, contracts] of Object.entries(output.contracts)) {
  for (const [contractName, contractData] of Object.entries(contracts)) {
    const artifactPath = path.join(artifactsDir, `${contractName}.json`);
    const artifact = {
      contractName,
      sourcePath,
      abi: contractData.abi,
      bytecode: contractData.evm.bytecode.object,
      deployedBytecode: contractData.evm.deployedBytecode.object,
    };
    fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2), "utf8");
    count++;
  }
}

console.log(`Compilation successful. Saved ${count} artifacts in artifacts/`);
