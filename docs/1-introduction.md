# Introduction

TypeScript library for client-side interactions with Arbitrum. Arbitrum SDK provides common helper functionality as well as access to the underlying smart contract interfaces.

Below is an overview of the Arbitrum SDK functionality. See the [tutorials](https://github.com/OffchainLabs/arbitrum-tutorials) for further examples of how to use these classes.

## Getting Started

Install dependencies

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
<TabItem value="npm" label="npm">

```sh
npm install @arbitrum/sdk
```

</TabItem>
<TabItem value="yarn" label="yarn">

```sh
yarn add @arbitrum/sdk
```

</TabItem>
<TabItem value="pnpm" label="pnpm">

```sh
pnpm install @arbitrum/sdk
```

</TabItem>
</Tabs>

## Using the Arbitrum SDK

### Bridging assets

Arbitrum SDK can be used to bridge assets to or from an Arbitrum Network. The following asset bridgers are currently available:

- [EthBridger](./reference/assetBridger/ethBridger.md)
- [Erc20Bridger](./reference/assetBridger/erc20Bridger.md)

All asset bridgers have the following methods which accept different parameters depending on the asset bridger type:

- [`deposit`](./reference/assetBridger/assetBridger.md#deposit) - moves assets from the Parent to the Child chain
- [`withdraw`](./reference/assetBridger/assetBridger.md#withdraw) - moves assets from the Child to the Parent chain

#### Example Deposit

Here is how you can deposit ether into Arbitrum One:

```ts
import { getArbitrumNetwork, EthBridger } from '@arbitrum/sdk'

// get the `@arbitrum/sdk` ArbitrumNetwork object using the chain id of the Arbitrum One chain
const childNetwork = await getArbitrumNetwork(42161)
const ethBridger = new EthBridger(childNetwork)

const ethDepositTxResponse = await ethBridger.deposit({
  amount: utils.parseEther('23'),
  parentSigner, // an ethers v5 signer connected to mainnet ethereum
  childProvider, // an ethers v5 provider connected to arbitrum one
})

const ethDepositTxReceipt = await ethDepositTxResponse.wait()
```

### Networks

Arbitrum SDK comes pre-configured for Mainnet and Sepolia, and their Arbitrum counterparts. However, the networks functionality can be used to register networks for custom Arbitrum instances. Most of the classes in Arbitrum SDK depend on network objects so this must be configured before using other Arbitrum SDK functionality.

#### Configuring Network

To interact with a custom [`ArbitrumNetwork`](./reference/dataEntities/networks), you can register it using the [`registerCustomArbitrumNetwork`](./reference/dataEntities/networks.md#registerCustomArbitrumNetwork) function.

```typescript
import { registerCustomArbitrumNetwork } from '@arbitrum/sdk'

registerCustomArbitrumNetwork({
  chainID: 123456,
  name: 'Custom Arbitrum Network',
})
```

### Cross chain messages

When assets are moved by the Parent and Child cross chain messages are sent. The lifecycles of these messages are encapsulated in the classes `ParentToChildMessage` and `ChildToParentMessage`. These objects are commonly created from the receipts of transactions that send cross chain messages. A cross chain message will eventually result in a transaction being executed on the destination chain, and these message classes provide the ability to wait for that finalizing transaction to occur.

#### Redeem a Parent to Child Message

```ts
import {
  ParentTransactionReceipt,
  ParentToChildMessageStatus,
} from '@arbitrum/sdk'

const parentTxnReceipt = new ParentTransactionReceipt(
  txnReceipt /** <-- ethers-js TransactionReceipt of an ethereum tx that triggered a Parent to Child message (say depositting a token via a bridge)  */
)

const parentToChildMessage = (
  await parentTxnReceipt.getParentToChildMessages(
    childSigner /** <-- connected ethers-js Wallet */
  )
)[0]

const res = await parentToChildMessage.waitForStatus()

if (res.status === ParentToChildMessageStatus.Child) {
  /** Message wasn't auto-redeemed; redeem it now: */
  const response = await parentToChildMessage.redeem()
  const receipt = await response.wait()
} else if (res.status === ParentToChildMessageStatus.REDEEMED) {
  /** Message succesfully redeeemed */
}
```

### Inbox tools

As part of normal operation the Arbitrum sequencer will send messages into the rollup chain. However, if the sequencer is unavailable and not posting batches, the inbox tools can be used to force the inclusion of transactions into the rollup chain.

### Utils

- [`EventFetcher`](./reference/utils/eventFetcher) - A utility to provide typing for the fetching of events
- [`MultiCaller`](./reference/utils/multicall#multicaller) - A utility for executing multiple calls as part of a single RPC request. This can be useful for reducing round trips.
- [`constants`](./reference/dataEntities/constants) - A list of useful Arbitrum related constants

### Run Integration tests

1. Copy the `.env-sample` file to `.env` and update the values with your own.
1. First, make sure you have a Nitro test node running. Follow the instructions [here](https://docs.arbitrum.io/node-running/how-tos/local-dev-node).
1. After the node has started up (that could take up to 20-30 mins), run `yarn gen:network`.
1. Once done, finally run `yarn test:integration` to run the integration tests.

Defaults to `Arbitrum Sepolia`, for custom network use `--network` flag.

`Arbitrum Sepolia` expects env var `ARB_KEY` to be prefunded with at least 0.02 ETH, and env var `INFURA_KEY` to be set.
(see `integration_test/config.ts`)

### Bridge A Standard Token

Bridging a new token to Child (i.e., deploying a new token contract) through the standard gateway is done by simply depositing a token that hasn't yet been bridged. This repo includes a script to trigger this initial deposit/deployment:

1. Clone `arbitrum-sdk`

2. `yarn install` (from root)

3. Set `PRIVKEY` environment variable (you can use .env) to the key of the account from which you'll be deploying (account should have some balance of the token you're bridging).

4. Set MAINNET_RPC environment variable to Parent RPC endpoint (i.e., https://mainnet.infura.io/v3/my-infura-key)

5. `yarn bridgeStandardToken`

Required CL params:
`networkID`:number — Chain ID of Child network
`parentTokenAddress`:string — address of Parent token to be bridged

Ex:
`yarn bridgeStandardToken --networkID 421614 --parentTokenAddress 0xdf03

## Examples

### Check if sequencer has included a transaction in Parent data

```ts
import { ChildTransactionReceipt } from '@arbitrum/sdk'

const childTxnReceipt = new ChildTransactionReceipt(
  txnReceipt /** <-- ethers-js TransactionReceipt of an arbitrum tx */
)

/** Wait 3 minutes: */
await new Promise(resolve => setTimeout(resolve, 1000 * 60 * 3000))

// if dataIsOnParent, sequencer has posted it and it inherits full rollup/Parent security
const dataIsOnParent = await childTxnReceipt.isDataAvailable(
  childProvider,
  parentProvider
)
```
