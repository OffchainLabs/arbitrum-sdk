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

// import { expect } from 'chai'

// import { fundL2, skipIfMainnet, wait } from './testHelpers'
// import { getArbTransactionReceipt } from '../src'
// import { JsonRpcProvider } from '@ethersproject/providers'
// import { Wallet } from 'ethers'
// import { parseEther } from 'ethers/lib/utils'
// import { testSetup } from '../scripts/testSetup'

// describe('ArbProvider', () => {
//   beforeEach('skipIfMainnet', async function () {
//     await skipIfMainnet(this)
//   })

//   it('does find l1 batch info', async () => {
//     const { l2Signer, l1Signer } = await testSetup()
//     const l2Provider = l2Signer.provider! as JsonRpcProvider

//     await fundL2(l2Signer)
//     const randomAddress = Wallet.createRandom().address
//     const amountToSend = parseEther('0.000005')

//     // send an l2 transaction, and get the receipt
//     const tx = await l2Signer.sendTransaction({
//       to: randomAddress,
//       value: amountToSend,
//     })
//     const rec = await tx.wait()
//     const testTxHash = rec.transactionHash

//     // wait for the batch data
//     // eslint-disable-next-line no-constant-condition
//     while (true) {
//       await wait(300)
//       const arbTxReceipt = await getArbTransactionReceipt(
//         l2Provider,
//         testTxHash,
//         true,
//         true
//       )
//       if (!arbTxReceipt) continue

//       const l1BlockNum = await l1Signer.provider!.getBlockNumber()
//       console.log(
//         arbTxReceipt.l1BatchNumber,
//         arbTxReceipt.l1BatchConfirmations,
//         l1BlockNum
//       )

//       if (arbTxReceipt.l1BatchNumber && arbTxReceipt.l1BatchNumber > 0) {
//         expect(
//           arbTxReceipt.l1BatchConfirmations,
//           'missing confirmations'
//         ).to.be.gt(0)
//       }
//       if (arbTxReceipt.l1BatchConfirmations > 0) {
//         expect(arbTxReceipt.l1BatchNumber, 'missing batch number').to.be.gt(0)
//       }

//       if (arbTxReceipt.l1BatchConfirmations > 8) {
//         break
//       }
//     }
//   })
// })
