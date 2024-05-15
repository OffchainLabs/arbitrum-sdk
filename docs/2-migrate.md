# Migrating from v3 to v4

`@arbitrum/sdk` v4 introduces a number of breaking changes. This document outlines the changes and provides guidance on how to migrate your existing v3 code to v4.

## Breaking Changes

With the launch of Orbit chains from Offchain Labs, the Arbitrum SDK has been updated to support the new chains. This has resulted in a number of breaking changes to the SDK. The following is a list of the most significant changes:

### L1 Network Removed

The Arbitrum SDK no longer requires the L1 network to be registered. Only Arbitrum networks need to be registered.

Arbitrum networks are any networks that are built with Arbitrum technology. This includes Arbitrum One, Arbitrum testnets, and any Orbit chain.

### Renaming L1/L2 to Parent/Child

Throughout the codebase, most instances of the terms "L1" and "L2" have been replaced with "parent" and "child." Any time that the code is referring explicitly to an "L1", "L2", or "L3" that term is used. Though in most circumstances, when the code is referring to a parent-child relationship between chains, the terms "parent" and "child" is used.

| v3 Name                      | v4 Name                             |
| ---------------------------- | ----------------------------------- |
| `L2TransactionReceipt`       | `ChildTransactionReceipt`           |
| `L1ContractTransaction`      | `ParentContractTransaction`         |
| `L1TransactionReceipt`       | `ParentTransactionReceipt`          |
| `L1ToL2Message`              | `ParentToChildMessage`              |
| `L1ToL2MessageWriter`        | `ParentToChildMessageWriter`        |
| `L1ToL2MessageReader`        | `ParentToChildMessageReader`        |
| `L1ToL2MessageStatus`        | `ParentToChildMessageStatus`        |
| `L1ToL2MessageReaderClassic` | `ParentToChildMessageReaderClassic` |
| `L1ToL2MessageWriter`        | `ParentToChildMessageWriter`        |
| `L1ToL2MessageStatus`        | `ParentToChildMessageStatus`        |
| `L1ToL2MessageGasEstimator`  | `ParentToChildMessageGasEstimator`  |
| `L2ToL1MessageStatus`        | `ChildToParentMessageStatus`        |
| `L2Network`                  | `ArbitrumNetwork`                   |
| `getL2Network`               | `getArbitrumNetwork`                |
| `addCustomNetwork`           | `registerCustomArbitrumNetwork`     |

#### Asset Bridger Class Methods

The `AssetBridger` class methods have been renamed to reflect the new Parent/Child terminology.

| v3 Name          | v4 Name            |
| ---------------- | ------------------ |
| `checkL1Network` | `checkParentChain` |
| `checkL2Network` | `checkChildChain`  |

#### Erc20Bridger Class Methods

The `Erc20Bridger` class methods have been renamed to reflect the new Parent/Child terminology.

| v3 Name                 | v4 Name                     |
| ----------------------- | --------------------------- |
| `getL1GatewayAddress`   | `getParentGatewayAddress`   |
| `getL2GatewayAddress`   | `getChildGatewayAddress`    |
| `getL2WithdrawalEvents` | `getWithdrawalEvents`       |
| `getL1ERC20Address`     | `getParentERC20Address`     |
| `getL2ERC20Address`     | `getChildERC20Address`      |
| `l1TokenIsDisabled`     | `isDepositDisabled`         |
| `l1Provider`            | `parentProvider`            |
| `getL1GatewaySetEvents` | `getParentGatewaySetEvents` |
| `getL2GatewaySetEvents` | `getChildGatewaySetEvents`  |

#### Message Classes

##### `ChildToParentMessageClassic` methods

| v3 Name           | v4 Name                  |
| ----------------- | ------------------------ |
| `getL2ToL1Events` | `getChildToParentEvents` |

##### `ChildToParentChainMessageNitro` methods

| v3 Name           | v4 Name                  |
| ----------------- | ------------------------ |
| `getL2ToL1Events` | `getChildToParentEvents` |

##### `ChildTransactionReceipt` methods

| v3 Name             | v4 Name                    |
| ------------------- | -------------------------- |
| `getL2ToL1Events`   | `getChildToParentEvents`   |
| `getL2ToL1Messages` | `getChildToParentMessages` |

##### `ParentTransactionReceipt` methods

| v3 Name                    | v4 Name                           |
| -------------------------- | --------------------------------- |
| `getL1ToL2MessagesClassic` | `getParentToChildMessagesClassic` |
| `getL1ToL2Messages`        | `getParentToChildMessages`        |

##### `ParentEthDepositTransactionReceipt` methods

| v3 Name     | v4 Name                          |
| ----------- | -------------------------------- |
| `waitForL2` | `waitForChildTransactionReceipt` |

##### `ParentContractCallTransactionReceipt` methods

| v3 Name     | v4 Name                          |
| ----------- | -------------------------------- |
| `waitForL2` | `waitForChildTransactionReceipt` |
