const { runTypeChain, glob } = require('typechain');
const { execSync } = require('child_process');
const { unlinkSync } = require('fs');

/**
 * Get the path of a package by its name.
 * @param {string} packageName The name of the package.
 * @returns {string} The path to the package.
 */
const getPackagePath = (packageName) => {
  const path = require.resolve(`${packageName}/package.json`);
  return path.substr(0, path.indexOf('package.json'));
};

async function main() {
  const cwd = process.cwd();

  // Retrieve paths for nitro and token bridge contracts
  const nitroPath = getPackagePath('@arbitrum/nitro-contracts');
  const tokenBridgePath = getPackagePath('@arbitrum/token-bridge-contracts');

  console.log('Compiling contracts.');

  // Validate npm_execpath environment variable
  const npmExec = process.env['npm_execpath'];
  if (!npmExec || npmExec === '') {
    throw new Error('npm_execpath environment variable is not set or empty. Please ensure your package manager is configured correctly.');
  }

  // Compile contracts for nitro and token bridge
  console.log('Building nitro contracts...');
  execSync(`${npmExec} run build`, {
    cwd: nitroPath,
  });

  console.log('Building token bridge contracts...');
  execSync(`${npmExec} run build`, {
    cwd: tokenBridgePath,
  });

  console.log('Compilation complete.');

  // Define paths to contract JSON files, excluding build-info
  const nitroFiles = glob(cwd, [
    `${tokenBridgePath}/build/contracts/!(build-info)/**/+([a-zA-Z0-9_]).json`,
    `${nitroPath}/build/contracts/!(build-info)/**/+([a-zA-Z0-9_]).json`,
  ]);

  // Generate TypeChain typings for nitro contracts
  await runTypeChain({
    cwd,
    filesToProcess: nitroFiles,
    allFiles: nitroFiles,
    outDir: './src/lib/abi/',
    target: 'ethers-v5',
  });

  // Define path for classic contract files
  const classicFiles = glob(cwd, [
    './src/lib/dataEntities/Outbox.json', // Hardcoded ABI for the old outbox
  ]);

  // Generate TypeChain typings for classic contracts
  await runTypeChain({
    cwd,
    filesToProcess: classicFiles,
    allFiles: classicFiles,
    outDir: './src/lib/abi/classic',
    target: 'ethers-v5',
  });

  // Delete index files to improve compatibility with tree shaking
  unlinkSync(`${cwd}/src/lib/abi/index.ts`);
  unlinkSync(`${cwd}/src/lib/abi/classic/index.ts`);

  console.log('TypeChain typings generated.');
}

main()
  .then(() => console.log('Process completed successfully.'))
  .catch((error) => {
    console.error('An error occurred:', error);
  });
