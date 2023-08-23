/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    compilers: [
      {
        version: '0.6.11',
        settings: {
          optimizer: {
            enabled: true,
            runs: 100,
          },
        },
      },
      {
        version: '0.8.7',
        settings: {
          optimizer: {
            enabled: true,
            runs: 100,
          },
        },
      },
    ],
    overrides: {},
  },
  paths: {
    sources: './contracts',
    artifacts: './build/contracts',
  },
  spdxLicenseIdentifier: {
    overwrite: false,
    runOnCompile: true,
  },
}
