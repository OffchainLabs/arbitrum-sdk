# Arbitrum SDK

TypeScript library for client-side interactions with Arbitrum. Arbitrum SDK provides common helper functionality as well as access to the underlying smart contract interfaces.

For usage examples and references, see [the Arbitrum SDK documentation](https://docs.arbitrum.io/sdk).

## Overview

### Bridging assets

Arbitrum SDK can be used to bridge assets to/from the rollup chain. The following asset bridgers are currently available:

- `EthBridger`
- `Erc20Bridger`

All asset bridgers have the following methods:

- `deposit` - moves assets from the parent chain to the child chain
- `depositEstimateGas` - estimates the gas required to do the deposit
- `withdraw` - moves assets from the child chain to the parent chain
- `withdrawEstimateGas` - estimates the gas required to do the withdrawal
  Which accept different parameters depending on the asset bridger type

### Cross chain messages

To move assets between chains, messages are sent from chain to chain. The lifecycles of these messages are encapsulated in the classes `ParentToChildMessage` and `ChildToParentMessage`. These objects are commonly created from the receipts of transactions that send cross chain messages. A cross chain message will eventually result in a transaction being executed on the destination chain, and these message classes provide the ability to wait for that finalizing transaction to occur.

### Networks

Arbitrum SDK comes pre-configured for Mainnet and Sepolia, and their Arbitrum counterparts. However, the networks functionality can be used to register networks for custom Arbitrum instances. Most of the classes in Arbitrum SDK depend on network objects so this must be configured before using other Arbitrum SDK functionality.

## Run Integration tests

1. First, make sure you have a Nitro test node running. Follow the instructions [here](https://docs.arbitrum.io/node-running/how-tos/local-dev-node).

2. After the node has started up (that could take up to 20-30 mins), run `yarn gen:network`.

3. Once done, finally run `yarn test:integration` to run the integration tests.

Defaults to `Arbitrum Sepolia`, for custom network use `--network` flag.

`Arbitrum Sepolia` expects env var `ARB_KEY` to be prefunded with at least 0.02 ETH, and env var `INFURA_KEY` to be set.
(see `integration_test/config.ts`)
