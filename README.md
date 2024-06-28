# Arbitrum SDK

[![npm version](https://badge.fury.io/js/%40arbitrum%2Fsdk.svg)](https://badge.fury.io/js/@arbitrum%2Fsdk.svg)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

A TypeScript library for client-side interactions with Arbitrum. The Arbitrum SDK provides essential helper functionality and direct access to underlying smart contract interfaces, enabling developers to build powerful applications on the Arbitrum network.

## Table of Contents

- [Arbitrum SDK](#arbitrum-sdk)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Installation](#installation)
  - [Key Features](#key-features)
    - [Bridging Assets](#bridging-assets)
    - [Cross-Chain Messages](#cross-chain-messages)
    - [Network Configuration](#network-configuration)
  - [Usage](#usage)
  - [Running Integration Tests](#running-integration-tests)
  - [Documentation](#documentation)
  - [License](#license)

## Overview

Arbitrum SDK simplifies the process of interacting with Arbitrum chains, offering a robust set of tools for asset bridging and cross-chain messaging.

## Installation

```bash
npm install @arbitrum/sdk

# or

yarn add @arbitrum/sdk
```

## Key Features

### Bridging Assets

Arbitrum SDK facilitates the bridging of assets between the parent chain (Ethereum) and Arbitrum chains. Currently supported asset bridgers:

- `EthBridger`: For bridging ETH
- `Erc20Bridger`: For bridging ERC20 tokens

Common methods for all asset bridgers:

- `deposit`: Move assets from the parent chain to the child chain
- `withdraw`: Move assets from the child chain to the parent chain

### Cross-Chain Messages

Cross-chain communication is handled through `ParentToChildMessage` and `ChildToParentMessage` classes. These encapsulate the lifecycle of messages sent between chains, typically created from transaction receipts that initiate cross-chain messages.

### Network Configuration

The SDK comes pre-configured for Arbitrum Mainnet and Sepolia testnet, along with their Arbitrum counterparts. Custom Arbitrum instances can be registered using `registerCustomArbitrumNetwork`, which is required before utilizing other SDK features.

## Usage

Here's a basic example of using the SDK to bridge ETH:

```ts
import { ethers } from 'ethers'
import { EthBridger, getArbitrumNetwork } from '@arbitrum/sdk'

async function bridgeEth(parentSigner: ethers.Signer, childChainId: number) {
  const childNetwork = await getArbitrumNetwork(childChainId)
  const ethBridger = new EthBridger(childNetwork)

  const deposit = await ethBridger.deposit({
    amount: ethers.utils.parseEther('0.1'),
    parentSigner,
  })

  const txReceipt = await deposit.wait()
  console.log(`Deposit initiated: ${txReceipt.transactionHash}`)
}
```

For more detailed usage examples and API references, please refer to the [Arbitrum SDK documentation](https://docs.arbitrum.io/sdk).

## Running Integration Tests

1. Set up a Nitro test node by following the instructions [here](https://docs.arbitrum.io/node-running/how-tos/local-dev-node).
2. Copy `.env.example` to `.env` and update relevant environment variables.
3. Generate the network configuration against your active Nitro test node:

   ```sh
   yarn gen:network
   ```

4. Execute the integration tests:

   ```sh
   yarn test:integration
   ```

## Documentation

For comprehensive guides and API documentation, visit the [Arbitrum SDK Documentation](https://docs.arbitrum.io/sdk).

## License

Arbitrum SDK is released under the [Apache 2.0 License](LICENSE).
