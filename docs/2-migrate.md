# Migrating from @arbitrum/sdk v3 to v4

## Introduction

`@arbitrum/sdk` v4 introduces significant changes to improve support Orbit chains from Offchain Labs. This guide outlines the breaking changes to know before migrating your existing v3 code to v4.

## Major Changes Overview

1. Removal of L1 Network requirement
2. Terminology shift from L1/L2 to Parent/Child
3. Renaming of classes, methods, and parameters
4. Updates to `AssetBridger` and `Erc20Bridger` classes
5. Changes to Message classes

## Detailed Changes

### 1. L1 Network Removed

- The SDK no longer requires the L1 network to be registered.
- Only Arbitrum networks need to be registered.
- Arbitrum networks include Arbitrum One, Arbitrum testnets, and any Orbit chain.

### 2. Terminology: L1/L2 to Parent/Child

Most instances of "L1" and "L2" have been replaced with "parent" and "child" respectively. This change reflects the more general parent-child relationship between chains in the Arbitrum ecosystem.

- In most circumstances, when referring to a parent-child relationship between chains, the terms "parent" and "child" are used.
- Though, when referring explicitly to "L1", "L2", or "L3", those specific terms are still used.

### 3. Renaming Classes, Methods, and Parameters

#### General Renaming

| v3 Name                       | v4 Name                                   |
| ----------------------------- | ----------------------------------------- |
| `L1TransactionReceipt`        | `ParentTransactionReceipt`                |
| `L1ContractTransaction`       | `ParentContractTransaction`               |
| `L1ToL2Message`               | `ParentToChildMessage`                    |
| `L1ToL2MessageWriter`         | `ParentToChildMessageWriter`              |
| `L1ToL2MessageReader`         | `ParentToChildMessageReader`              |
| `L1ToL2MessageReaderClassic`  | `ParentToChildMessageReaderClassic`       |
| `L1ToL2MessageStatus`         | `ParentToChildMessageStatus`              |
| `L1ToL2MessageGasEstimator`   | `ParentToChildMessageGasEstimator`        |
| `L2TransactionReceipt`        | `ChildTransactionReceipt`                 |
| `L2ContractTransaction`       | `ChildContractTransaction`                |
| `L2ToL1Message`               | `ChildToParentMessage`                    |
| `L2ToL1MessageWriter`         | `ChildToParentMessageWriter`              |
| `L2ToL1MessageReader`         | `ChildToParentMessageReader`              |
| `L2ToL1MessageStatus`         | `ChildToParentMessageStatus`              |
| `L2Network`                   | `ArbitrumNetwork`                         |
| `getL2Network`                | `getArbitrumNetwork`                      |
| `addCustomNetwork`            | `registerCustomArbitrumNetwork`           |
| `EthDepositStatus`            | `EthDepositMessageStatus`                 |
| `EthDepositMessageWaitResult` | `EthDepositMessageWaitForStatusResult`    |
| `L1ToL2MessageWaitResult`     | `ParentToChildMessageWaitForStatusResult` |

### 4. AssetBridger Classes

#### AssetBridger Class Methods

The `AssetBridger` class methods have been renamed to reflect the new Parent/Child terminology.

| v3 Name          | v4 Name            |
| ---------------- | ------------------ |
| `checkL1Network` | `checkParentChain` |
| `checkL2Network` | `checkChildChain`  |

#### AssetBridger Class Method Parameters

The objects passed to the class methods of classes that inherit from `AssetBridger` (`EthBridger` and `Erc20Bridger`) have all been updated to reflect the new Parent/Child terminology.

| v3 Name          | v4 Name              |
| ---------------- | -------------------- |
| `erc20L1Address` | `erc20ParentAddress` |
| `l1Provider`     | `parentProvider`     |
| `l2Provider`     | `childProvider`      |
| `l1Signer`       | `parentSigner`       |
| `l2Signer`       | `childSigner`        |

#### Erc20Bridger Class Methods

| v3 Name                 | v4 Name                     |
| ----------------------- | --------------------------- |
| `getL1GatewayAddress`   | `getParentGatewayAddress`   |
| `getL2GatewayAddress`   | `getChildGatewayAddress`    |
| `getL2WithdrawalEvents` | `getWithdrawalEvents`       |
| `getL1TokenContract`    | `getParentTokenContract`    |
| `getL1ERC20Address`     | `getParentErc20Address`     |
| `getL2TokenContract`    | `getChildTokenContract`     |
| `getL2ERC20Address`     | `getChildErc20Address`      |
| `l1TokenIsDisabled`     | `isDepositDisabled`         |
| `l1Provider`            | `parentProvider`            |
| `getL1GatewaySetEvents` | `getParentGatewaySetEvents` |
| `getL2GatewaySetEvents` | `getChildGatewaySetEvents`  |

### 5. Message Classes

Message classes have been renamed and their methods updated:

#### `ChildToParentMessageClassic`

| v3 Name           | v4 Name                  |
| ----------------- | ------------------------ |
| `getL2ToL1Events` | `getChildToParentEvents` |

#### `ChildToParentChainMessageNitro`

| v3 Name           | v4 Name                  |
| ----------------- | ------------------------ |
| `getL2ToL1Events` | `getChildToParentEvents` |

#### `ChildTransactionReceipt`

| v3 Name             | v4 Name                    |
| ------------------- | -------------------------- |
| `getL2ToL1Events`   | `getChildToParentEvents`   |
| `getL2ToL1Messages` | `getChildToParentMessages` |

#### `ParentToChildMessage`

| v3 Name            | v4 Name                   |
| ------------------ | ------------------------- |
| `EthDepositStatus` | `EthDepositMessageStatus` |

#### `ParentTransactionReceipt`

| v3 Name                    | v4 Name                           |
| -------------------------- | --------------------------------- |
| `getL1ToL2MessagesClassic` | `getParentToChildMessagesClassic` |
| `getL1ToL2Messages`        | `getParentToChildMessages`        |

#### `ParentEthDepositTransactionReceipt`

| v3 Name     | v4 Name                          |
| ----------- | -------------------------------- |
| `waitForL2` | `waitForChildTransactionReceipt` |

#### `ParentContractCallTransactionReceipt`

| v3 Name     | v4 Name                          |
| ----------- | -------------------------------- |
| `waitForL2` | `waitForChildTransactionReceipt` |
