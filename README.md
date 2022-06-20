# Arbitrum SDK

Typescript library for client-side interactions with Arbitrum. Arbitrum SDK provides common helper functionaliy as well access to the underlying smart contract interfaces.

Below is an overview of the Arbitrum SDK functionality. See the [tutorials](https://github.com/OffchainLabs/arbitrum-tutorials) for further examples of how to use these classes.

### Quickstart Recipes

- ##### Deposit Ether Into Arbitrum

```ts
import { getL2Network, EthBridger } from '@arbitrum/sdk'

const l2Network = await getL2Network(
  l2ChainID /** <-- chain id of target Arbitrum chain */
)
const ethBridger = new EthBridger(l2Network)

const ethDepositTxResponse = await ethBridger.deposit({
  amount: utils.parseEther('23'),
  l1Signer: l1Signer /** <-- connected ethers-js Wallet */,
  l2Provider: l2Provider /** <--- ethers-js Provider */,
})

const ethDepositTxReceipt = await ethDepositTxResponse.wait()

/** check ethDepositTxReceipt.status  */
```

- ##### Redeem an L1 to L2 Message

```ts
import { L1TransactionReceipt, L1ToL2MessageStatus } from '@arbitrum/sdk'

const l1TxnReceipt = new L1TransactionReceipt(
  txnReceipt /** <-- ethers-js TransactionReceipt of an ethereum tx that triggered an L1 to L2 message (say depositting a token via a bridge)  */
)

const l1ToL2Message = (
  await l1TxnReceipt.getL1ToL2Messages(
    l2Signer /** <-- connected ethers-js Wallet */
  )
)[0]

const res = await l1ToL2Message.waitForStatus()

if (res.status === L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2) {
  /** Message wasn't auto-redeemed; redeem it now: */
  const response = await l1ToL2Message.redeem()
  const receipt = await response.wait()
} else if (res.status === L1ToL2MessageStatus.REDEEMED) {
  /** Message succesfully redeeemed */
}
```

- ##### Check if sequencer has included a transaction in L1 data

```ts
import { L2TransactionReceipt } from '@arbitrum/sdk'

const l2TxnReceipt = new L2TransactionReceipt(
  txnReceipt /** <-- ethers-js TransactionReceipt of an arbitrum tx */
)

/** Wait 3 minutes: */
await new Promise(resolve => setTimeout(resolve, 1000 * 60 * 3000))

// if dataIsOnL1, sequencer has posted it and it inherits full rollup/L1 security
const dataIsOnL1 = await l2TxnReceipt.isDataAvailable(l2Provider, l1Provider)
```

### Bridging assets

Arbitrum SDK can be used to bridge assets to/from the rollup chain.The following asset bridgers are currently available:

- EthBridger
- Erc20Bridger

All asset bridgers have the following methods:

- **deposit** - moves assets from the L1 to the L2
- **depositEstimateGas** - estimates the gas required to do the deposit
- **withdraw** - moves assets from the L2 to the L1
- **withdrawEstimateGas** - estimate the gas required to do the withdrawal
  Which accept different parameters depending on the asset bridger type

### Cross chain messages

When assets are moved by the L1 and L2 cross chain messages are sent. The lifecycles of these messages are encapsulated in the classes `L1ToL2Message` and `L2ToL1Message`. These objects are commonly created from the receipts of transactions that send cross chain messages. A cross chain message will eventually result in a transaction being executed on the destination chain, and these message classes provide the ability to wait for that finalizing transaction to occur.

### Networks

Arbitrum SDK comes pre-configured for the Mainnet and Rinkeby, and their Arbitrum counterparts. However the networks functionlity can be used register networks for custom Arbitrum instances. Most of the classes in Arbitrum SDK depend on network objects so this must be configured before using other Arbitrum SDK functionlity.

### Inbox tools

As part of normal operation the Arbitrum sequencer will messages into the rollup chain. However, if the sequencer is unavailable and not posting batches, the inbox tools can be used to force the inclusion of transactions into the rollup chain.

### Utils

- **EventFetcher** - A utility to provide typing for the fetching of events
- **MultiCaller** - A utility for executing multiple calls as part of a single RPC request. This can be useful for reducing round trips.
- **constants** - A list of useful Arbitrum related constants

### Run Integration tests

`yarn test:integration`

Defaults to `rinkArby`, for custom network use `--network` flag.

`rinkArby` expects env var `ARB_KEY` to be prefunded with at least 0.02 ETH, and env var `INFURA_KEY` to be set.
(see `integration_test/config.ts`)

### Bridge A Standard Token

Bridging new a token to L2 (i.e., deploying a new token contract) through the standard gateway is done by simply depositing a token that hasn't yet been bridged. This repo includes a script to trigger this initial deposit/deployment:

1. clone `arbitrum-sdk`

2. `yarn install` (from root)

3. Set `PRIVKEY` environmental variable (you can use .env) to the key of the account from which you'll be deploying (account should have some balance of the token you're bridging).

4. Set MAINNET_RPC environmental variable to L1 RPC endpoint (i.e., https://mainnet.infura.io/v3/my-infura-key)

5. `yarn bridgeStandardToken`

Required CL params:
`networkID`:number — Chain ID of L2 network
`l1TokenAddress`:string — address of L1 token to be bridged

Ex:
`yarn bridgeStandardToken --networkID 421611 --l1TokenAddress 0xdf032bc4b9dc2782bb09352007d4c57b75160b15 --amount 3`
