/*
 * Copyright 2021, Offchain Labs, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* eslint-env node */
'use strict'

import { expect } from 'chai'
import { Logger, LogLevel } from '@ethersproject/logger'
Logger.setLogLevel(LogLevel.ERROR)
import { BigNumber, providers, Wallet } from 'ethers'
import { anything, instance, mock, when } from 'ts-mockito'
import { Erc20Bridger } from '../../src/lib/assetBridger/erc20Bridger'
import { getArbitrumNetwork } from '../../src/lib/dataEntities/networks'
import { L1GatewayRouter__factory } from '../../src/lib/abi/factories/L1GatewayRouter__factory'

// Function selectors, verified against the real L1GatewayRouter ABI:
//   outboundTransfer(address,address,uint256,uint256,uint256,bytes)
//   outboundTransferCustomRefund(address,address,address,uint256,uint256,uint256,bytes)
const iface = L1GatewayRouter__factory.createInterface()
const OUTBOUND_TRANSFER_SELECTOR = iface.getSighash('outboundTransfer')
const OUTBOUND_TRANSFER_CUSTOM_REFUND_SELECTOR = iface.getSighash(
  'outboundTransferCustomRefund'
)

describe('Erc20Bridger excessFeeRefundAddress selection', () => {
  const token = Wallet.createRandom().address
  const from = Wallet.createRandom().address
  const destinationAddress = Wallet.createRandom().address
  const thirdPartyRefund = Wallet.createRandom().address
  const standardGateway = Wallet.createRandom().address

  /**
   * Sets up a bridger whose parent-provider `.call` mock captures the
   * function selector chosen for the deposit's `outboundTransfer(...)` /
   * `outboundTransferCustomRefund(...)` call, then makes the rest of
   * `getDepositRequest`'s flow (retryable-data probe, gas estimation) throw
   * a deliberate sentinel error - we only care about which selector was
   * chosen on the *first* call to the gateway router, which happens before
   * any of that later machinery runs.
   */
  const captureSelector = async (excessFeeRefundAddress?: string) => {
    const l1Network = await getArbitrumNetwork(42161)
    const bridger = new Erc20Bridger(l1Network)

    let capturedSelector: string | undefined

    const parentProviderMock = mock(providers.JsonRpcProvider)
    when(parentProviderMock._isProvider).thenReturn(true)
    when(parentProviderMock.getNetwork()).thenResolve({
      chainId: l1Network.parentChainId,
    } as any)
    const handleCall = (tx: { to?: string; data?: string }) => {
      if (
        tx.to === l1Network.tokenBridge.parentGatewayRouter &&
        typeof tx.data === 'string' &&
        (tx.data.startsWith(OUTBOUND_TRANSFER_SELECTOR) ||
          tx.data.startsWith(OUTBOUND_TRANSFER_CUSTOM_REFUND_SELECTOR))
      ) {
        // this is the deposit calldata built by `depositFunc` - capture
        // which function it chose, then stop the flow deliberately so we
        // don't need to model the rest of gas estimation.
        capturedSelector = tx.data.slice(0, 10)
        return Promise.reject(new Error('STOP_AFTER_CAPTURE'))
      }
      // getParentGatewayAddress -> router.getGateway(token), invoked via
      // ethers.Contract (which calls `.call(tx, blockTag)`, 2 args)
      return Promise.resolve(
        iface.encodeFunctionResult('getGateway', [standardGateway])
      )
    }
    // `parentProvider.call(...)` is invoked with 1 arg directly by
    // `populateFunctionParams` (the deposit-calldata probe) and with 2 args
    // (tx, blockTag) when routed through an ethers.Contract instance (the
    // `getGateway` lookup) - both need to be stubbed.
    when(parentProviderMock.call(anything())).thenCall(handleCall)
    when(parentProviderMock.call(anything(), anything())).thenCall(handleCall)
    const parentProvider = instance(parentProviderMock)

    const childProviderMock = mock(providers.JsonRpcProvider)
    when(childProviderMock._isProvider).thenReturn(true)
    when(childProviderMock.getNetwork()).thenResolve({
      chainId: l1Network.chainId,
    } as any)
    const childProvider = instance(childProviderMock)

    try {
      await bridger.getDepositRequest({
        amount: BigNumber.from(1000),
        erc20ParentAddress: token,
        parentProvider,
        childProvider,
        from,
        destinationAddress,
        excessFeeRefundAddress,
      })
    } catch (err) {
      // We deliberately stop the flow right after the deposit calldata is
      // built (the thing under test) rather than modelling the rest of
      // retryable-data parsing and gas estimation, which is irrelevant to
      // which function selector was chosen. Any error at this point is
      // expected and swallowed; we assert on `capturedSelector` below
      // instead, which is only set once the calldata has actually been
      // built and inspected.
    }

    expect(capturedSelector, 'expected the deposit calldata to be captured').to
      .exist
    return capturedSelector as string
  }

  it('uses outboundTransferCustomRefund when excessFeeRefundAddress is unset and destination differs from sender (the default, most common, deposit-to-another-address path)', async () => {
    // no excessFeeRefundAddress passed -> applyDefaults sets it to `from`,
    // while destinationAddress is a *different* address. The refund must
    // still be routed to `from` explicitly, which only
    // outboundTransferCustomRefund can do - outboundTransfer always sends
    // the refund to `destinationAddress` on-chain, per
    // L1ArbitrumGateway.sol's `outboundTransfer(...) { return
    // outboundTransferCustomRefund(_l1Token, _to, _to, ...) }`.
    const selector = await captureSelector(undefined)
    expect(selector).to.eq(OUTBOUND_TRANSFER_CUSTOM_REFUND_SELECTOR)
  })

  it('uses outboundTransferCustomRefund when excessFeeRefundAddress is explicitly set to `from` while depositing to a different destination (the sharpest previously-broken case)', async () => {
    // caller explicitly asks for their own refund back while depositing to
    // someone else - this must never be silently redirected to the
    // recipient.
    const selector = await captureSelector(from)
    expect(selector).to.eq(OUTBOUND_TRANSFER_CUSTOM_REFUND_SELECTOR)
  })

  it('uses outboundTransferCustomRefund when excessFeeRefundAddress is a third party (neither from nor destination)', async () => {
    const selector = await captureSelector(thirdPartyRefund)
    expect(selector).to.eq(OUTBOUND_TRANSFER_CUSTOM_REFUND_SELECTOR)
  })

  it('uses the plain outboundTransfer fallback only when excessFeeRefundAddress already equals destinationAddress (the one case where the two functions produce the same refund behaviour)', async () => {
    const selector = await captureSelector(destinationAddress)
    expect(selector).to.eq(OUTBOUND_TRANSFER_SELECTOR)
  })
})
