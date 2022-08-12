# Arbitrum SDK

Typescript library for client-side interactions with Arbitrum. Arbitrum SDK provides common helper functionaliy as well access to the underlying smart contract interfaces.

Below is an overview of the Arbitrum SDK functionality. See the [tutorials](https://github.com/OffchainLabs/arbitrum-tutorials) for further examples of how to use these classes.

@arbitrum/sdk / [Exports](modules.md)

###

API Docs

- [Eth Bridger](classes/assetBridger_erc20Bridger.Erc20Bridger.md) Move Eth between L1 and L2 via the canonical Arbitrum bridge
- [ERC20 Bridger](classes/assetBridger_erc20Bridger.Erc20Bridger.md) Move tokens between L1 and L2 via the canonical Arbitrum bridge
- [Inbox Tools](classes/inbox_inbox.InboxTools.md) Methods for including a tx on L2 without relying on the sequencer
- [Arb Txn Receipts](modules/utils_arbProvider.md) Get Arbitrum-specific L2 tx info; i.e., different components of gas usage, status of L1 inclusion, etc.
- [L1-L2-Messages](modules/message_L1ToL2Message.md) Create, redeem, and check status of L1-to-L2 messages
- [L2-to-L1 messages](classes/message_L2ToL1Message.L2ToL1MessageWriter.md) Create, redeem, and check status of L2-to-L1 messages

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

const l1ToL2Message = await l1TxnReceipt.getL1ToL2Message(
  l2Signer /** <-- connected ethers-js Wallet */
)

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
s
/** Wait 3 minutes: */
setTimeout(() => {
  const dataIsOnL1 = l2TxnReceipt.isDataAvailable(l2Provider, l1Provider)
  // if dataIsOnL1, sequencer has posted it and it inherits full rollup/L1 security
}, 1000 * 60 * 3000)
```
