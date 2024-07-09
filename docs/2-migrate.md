# Migrating from @arbitrum/sdk v3 to v4

## Introduction

`@arbitrum/sdk` v4 introduces significant changes to improve support Orbit chains from Offchain Labs. This guide outlines the breaking changes to know before migrating your existing v3 code to v4.

## Major Changes Overview

1. Terminology shift from L1/L2 to parent-child
2. Network types and methods updated
3. Updates to `AssetBridger` and `Erc20Bridger` classes
4. Changes to Message classes

## Detailed Changes

### 1. Terminology: L1/L2 to parent/child

Most instances of "L1" and "L2" have been replaced with "parent" and "child" respectively. This change reflects the more general parent-child relationship between chains in the Arbitrum ecosystem.

- In most circumstances, when referring to a parent-child relationship between chains, the terms "parent" and "child" are used.
- Though, when referring explicitly to "L1", "L2", or "L3", those specific terms are still used.

### 2. Network changes

- The `L1Network` is no longer required to be registered before bridging.
- Only Arbitrum networks need to be registered.
- Arbitrum networks are defined as Arbitrum One, Arbitrum testnets, and any Orbit chain.

| v3 Name               | v4 Name                         |
| --------------------- | ------------------------------- |
| `L2Network`           | `ArbitrumNetwork`               |
| `getL2Network`        | `getArbitrumNetwork`            |
| `addCustomNetwork`    | `registerCustomArbitrumNetwork` |
| `Network`             | deprecated                      |
| `L1Network`           | deprecated                      |
| `getL1Network`        | deprecated                      |
| `getParentForNetwork` | deprecated                      |

#### `ArbitrumNetwork` type

`Network` type has been replaced with the `ArbitrumNetwork` type and some properties have been deprecated or renamed.

| v3 Name               | v4 Name         |
| --------------------- | --------------- |
| `chainID`             | `chainId`       |
| `partnerChainID`      | `parentChainId` |
| `explorerUrl`         | deprecated      |
| `isArbitrum`          | deprecated      |
| `partnerChainIDs`     | deprecated      |
| `nitroGenesisBlock`   | deprecated      |
| `nitroGenesisL1Block` | deprecated      |
| `depositTimeout`      | deprecated      |
| `blockTime`           | deprecated      |
| `isBold`              | deprecated      |

#### `TokenBridge` type

The `TokenBridge` type within the `ArbitrumNetwork` object has been updated.

| v3 Name           | v4 Name               |
| ----------------- | --------------------- |
| `l1CustomGateway` | `parentCustomGateway` |
| `l1ERC20Gateway`  | `parentErc20Gateway`  |
| `l1GatewayRouter` | `parentGatewayRouter` |
| `l1MultiCall`     | `parentMultiCall`     |
| `l1ProxyAdmin`    | `parentProxyAdmin`    |
| `l1Weth`          | `parentWeth`          |
| `l1WethGateway`   | `parentWethGateway`   |
| `l2CustomGateway` | `childCustomGateway`  |
| `l2ERC20Gateway`  | `childErc20Gateway`   |
| `l2GatewayRouter` | `childGatewayRouter`  |
| `l2Multicall`     | `childMulticall`      |
| `l2ProxyAdmin`    | `childProxyAdmin`     |
| `l2Weth`          | `childWeth`           |
| `l2WethGateway`   | `childWethGateway`    |

### 3. `AssetBridger` Classes

#### `AssetBridger` Class Methods

The `AssetBridger` class methods have been renamed to reflect the new parent-child terminology.

| v3 Name          | v4 Name            |
| ---------------- | ------------------ |
| `checkL1Network` | `checkParentChain` |
| `checkL2Network` | `checkChildChain`  |

#### `AssetBridger` Class Method Parameters

The objects passed to the class methods of classes that inherit from `AssetBridger` (`EthBridger` and `Erc20Bridger`) have been renamed.

| v3 Name          | v4 Name              |
| ---------------- | -------------------- |
| `erc20L1Address` | `erc20ParentAddress` |
| `l1Provider`     | `parentProvider`     |
| `l2Provider`     | `childProvider`      |
| `l1Signer`       | `parentSigner`       |
| `l2Signer`       | `childSigner`        |

#### `Erc20Bridger` Class Methods

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

### 4. Message Classes

Message classes have been renamed and their methods updated:

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
| `EthDepositStatus`            | `EthDepositMessageStatus`                 |
| `EthDepositMessageWaitResult` | `EthDepositMessageWaitForStatusResult`    |
| `L1ToL2MessageWaitResult`     | `ParentToChildMessageWaitForStatusResult` |

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