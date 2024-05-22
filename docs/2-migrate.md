# Migrating from v3 to v4

Arbitrum v4 introduces a number of changes to the Arbitrum SDK. This document outlines the changes and provides guidance on how to migrate your existing v3 code to v4.

## Breaking Changes

With the launch of Orbit chains from Offchain Labs, the Arbitrum SDK has been updated to support the new chains. This has resulted in a number of breaking changes to the SDK. The following is a list of the most significant changes:

### Renaming L1/L2 to Parent/Child

The terms L1 and L2 have been replaced with Parent and Child to better reflect the new Orbit chain architecture. The Arbitrum SDK has been updated to reflect this change.

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
| `getL2WithdrawalEvents` | `getChildWithdrawalEvents`  |
| `getL1ERC20Address`     | `getParentERC20Address`     |
| `getL2ERC20Address`     | `getChildERC20Address`      |
| `l1TokenIsDisabled`     | `parentTokenIsDisabled`     |
| `l1Provider`            | `parentProvider`            |
| `getL1GatewaySetEvents` | `getParentGatewaySetEvents` |
| `getL2GatewaySetEvents` | `getChildGatewaySetEvents`  |

### Removing L1 network

The Arbitrum SDK no longer requires the L1 network to be specified. The Arbitrum SDK now only requires the Child network to be registered.
