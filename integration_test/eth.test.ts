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
import dotenv from 'dotenv'

import { Wallet } from '@ethersproject/wallet'
import { parseEther } from '@ethersproject/units'

import { ArbGasInfo__factory } from '../src/lib/abi/factories/ArbGasInfo__factory'
import {
  instantiateBridgeWithRandomWallet,
  fundL1,
  fundL2,
  prettyLog,
  skipIfMainnet,
  wait,
} from './testHelpers'
import { ARB_GAS_INFO } from '../src/lib/dataEntities/constants'
import {
  L2ToL1Message,
  L2ToL1MessageStatus,
} from '../src/lib/message/L2ToL1Message'
import { L1ToL2MessageStatus } from '../src/lib/message/L1ToL2Message'
import { TestERC20__factory } from '../src/lib/abi/factories/TestERC20__factory'
import { JsonRpcProvider } from '@ethersproject/providers'
import { BigNumber } from 'ethers'
dotenv.config()

describe('Ether', async () => {
  beforeEach('skipIfMainnet', async function () {
    await skipIfMainnet(this)
  })

  // CHRIS: TODO: remove
  it('test call', async () => {
    const { l2Signer, l1Signer } = await instantiateBridgeWithRandomWallet()

    await fundL2(l2Signer)

    const fac = new TestERC20__factory(l2Signer)
    const faceOff = await fac.deploy()

    // const gasEst = await faceOff.estimateGas.mint()
    const gasEst = await faceOff.estimateGas.mint({ gasLimit: 1500000 })
    console.log(gasEst.toString())

    const res = await (await faceOff.mint()).wait()

    const rec1 = await (l2Signer.provider as JsonRpcProvider)?.send(
      'eth_getTransactionReceipt',
      [res?.transactionHash]
    )
    console.log("rec1", rec1)
    const eg1 = BigNumber.from(rec1.effectiveGasPrice)
    const l1GasUsed1 = BigNumber.from(rec1.l1GasUsed)
    const totalGasUsed1 = BigNumber.from(rec1.gasUsed)

    const l1Gas = (32 + 32 + 32 + 32 + 20) * 16

    // 334448 = 2336 * l1gasprice / l2gasprice


    // l1 gas used in the tx receipt = (actual l1 gas used / l2 gas price )

    1600000000

    67758

    const q = "0x6f12b0c900000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000eaa001bab23239293d61f025047eac29f3fff7e3fb159ef7b30246706bb7b16ce257b62f9266d094da0bf537943be980c03273ec3ee55f48b98e7579cf6c988034dd7a18f88136f1c49f2d39add7ad00ec1818e3e39f081804f6d1900957180a003802a9ab567131fd8b79c2728aad7ab67e21ae8efd752bb7b4009ab5b1719592101ffed2f2a34aefc9642c01b3c4cf652e06d8a0ce30155a7b28a4891632723d7185be3ba0ca7e1637e6f8b44acfc7faeb1f3640767a79ca9d91f5e7f1c30ebfb23b3d2a11f63bed7fe7320dfe7f75f4056fec6eddda3afe5ef7be2f9c7eef3f13badf7167f34f6c0f9ffbc5ee6c376bb67e3edf2f4fe7bd827ed70d09cf33ffeed556b5e9af369ff51ab7f2d5ffcf4d8632bb73f18bf72d5e6374eaf07ffaa7e7dd995c77d72e833c7bcb4eace377f9c3cab7eee9a6967defb68f0dc8e23f729ae3f0998f5fdb159e9d08f574cfefccfbaf7f6dee796de3362c8a527ad9bd5ea73f03f962cddf582935bf7acc3d64ec7ff790380bc5d9e7ed8bbc77e7da5f5e8c6cb17eedf5e36e1afbf0413efa9768f338fdcee8f19b2d3eecffff9f4fd3ebdfefdb5b7deb5cff77f18f4e3a98f2d3ca1f3b8096f6df8f5a95d3e3bf15fee752518a5ec798acdbb61fc19c0ac1fc6ff3b2b1dfab1ccf7da7f0ee4fb2072675facdc22e50de35791a45ab850ba09c0d09840fec203828640d08cda9e4c0016c5c17fe72324a4d747d909e0242fe247899d1f294183da9ecb13802ca65a3dd979d423f4cea834248652928f2ab55548b3d3907c94098c1f4ab3cd12aaa10982b2f5ba34b6fe854f1aea62a3baec061bd4ee126de8d2c613081d1e61876ef236ea3be161ede9260f12c0ca80b65443aa859206cff8850e9d78dd52ff8679d3e7df70e3f445d75c791dad1f9586415b3513b7269e7ec1387ae372378625803b923f2a81be3776903f3ae209f4e98c384102b8626e02d6a2ab67bf93b6c7d501d711e79a090fa0c103103c5e19780d60e21ba38bec9b1c1fa3b562ed04ac7ef9014f7b07d958558dcc8709dab0e6b17cbf832088f832d725de6425345682584728c3ba14b0ad17e5d62724857693398fdda9d4408d39348fbe7fd44d807d40fe28e1cbed991cf1726eb464af92e484c9de9fc6de1fb18f53867d3560dbaf5bb6bf5a8af5c9b203f1a5f5f45962a3e01aba78f020afbcc242179ed1a64337c936314ec338c20e54063b0f66813de5272cb07725d1363983689c4188334619ce1f01d359732155275fae46a38d9fd54dbe7120b48fd1a649fb36c5338940f54cce6b34ce6b88f3a9324a3300b3143386f6ad84098cbb4d2da15a5da7daa610b54fff6a06a6e4862453e9529ad2a568e996f6f123cc7479b28cae2f81f2324ddd9afc35a813281f1bf1203d42d4c945fad582d52cd4b00e2dbf27a164833025f45c8160d91e599a6982907c025f5305c9d72cc54251654802e51b62591ff63899c48ed5cd04ca1f0c43600eae6e2af4ed3f888d42aed2a13b4ea8eaaa69c847a30971231fae9140f9bbc2fc5bf253c403ed0bc4b89dd15caa9e8dbf8b09d2262196dbe963455c74fd5d26d0672ac11282af7ecd1532040ca925ac7b8800ef73b12abd3e5ab66a70e9e94305ac8d37a911c2faadf9f0d3d53ca3dd973af5d15b819c436d7bfedfdb914deaecf8cee7c83f531738ffb9895c4f3de35cfc18798df995e4939557c34ab180d7232e5ba55f5eb5470878270673dfbf9c77951113c8db4617f24caad31bf80a79b1ff84eb8f24efa5e62d7f673ff26773f78eefb8466b24b524e8a9a78e8f3961c713f089600b234e356994775085593dcd30cceaa6c80a9da1598d5a661901cfd221aec029719a623d53a86bb902074711f2683ad0296aaa78d2851b6ac452d9b24e98916f0b847e7697a79a0d4cc08322d0c9137ec5056e2126bb6daa8d1f713cafc10a88d34f96563d4d3e56057b08495fe3baac75c5fa38c6252e14ecfd88031778b560dfb794ba71f3a8a9f32f9f27f50cf92956b5f134d566247ead232c269c8dac595e5b17deb8ebbb5a38bd110d58d6e2f9396745b8785a7bf3cde355f533c4f0f2a62845aa29acee8d0000e9505758bd7d4214636314eed59c1b23abf3d89b9c30b3721cda2d391bda5134f7e71a2da58de548c3acf80f0e8a49084a7b0aa353f158679954f92282c2171f270c8a6d8170beeb0d7e01fa9aab55bea75d4908aaf7e57ba2f464cb2eed447eb25ef8449447b00fcb3eaaedf231edbbeeffaab73417aa5f9f9287440e1bc072abaaa6364985c3859ebe2be4f641c7ff8e3406819960a33f4e8a554ff4dd1a71ea960d737a1aa84216419740205ce7b916ea6d5eafee653d39a69aa596c2147511aa3424ead18536192a255dc16e8f25558608b62d061b9059835959e8dd6a08767bc49597e33d67294f1b69e8f4c0f15f281b2ad859b1d236553c85c638238294fdbc82bd26d8f3a25f1af13c17fd567bee542c8c886f827dbba065fdf8b914fd8f8878c4a9dae8d681d33fcf7331e030b170d25c381d43e40ae7e4d5f12e8c924af5d4faa2f3619a6a96b0e6863678043a0d6921f921d5525f0ba73982a011d03334d538c84e2f0b7ec3e856bbdd6e8b81cf7b11c732bea748cb20027298b9fc4f0c3a2ce23aa0cdd3b99cc12e6461b309ef98ef7a74eaa9907c99618fee09a9661462782adf6cf2d2b008b5df98de38a8871789090719a98ea35189aa8d73e4b2adbb30f2a147aeff73c0cb1bfaa9b588adfdfa9c93e67dfa72d1458ff54e7f7e53684d7cbf92e451981d8ef9f09c6f9ba6e60963a826b316ae15cd18a6c968c6ceb85ae6abd7f35d0c190f39903350ab8720ddac93dfda8e0385a9026005a45e062c687638dcbc869f29bcc09059c0a0f05d565f944c56e9382bd59e33ade6faa699414536901920eede90798deea496aac6cda8f981d5772b7bab1082acfd75a436cbb452104913d0bd2d27d32d1e8fecc0db962e568df6e3b1ceb5c8e86d8db51b511435207a2c1637388e23db2d1eb3a8414421fbfa007256f5f8f8386499e44cc29d2c8d163611cbb3ff520987d8cec7e50afe74763a6e9c72eaa812a44feab34021c4e131a1b625855c7039cf03d4e22718b6346aa732f77cef7a3f602ecf5c4c3597474c251c64bd6f41e18746043bacbeb7c6c6c6a068c173bc098484ad959021bb8e1d5daa08148b77c3b1d8d076c40ec7a1b3abdd907213acb611cc90dd6b10cea805d9f6e4e4a417107e3513b3ccb5fc0bfc9bb399da882331166605abd0cd93eb0f83ec97eb54c87e19840b6b750ad91fe6d38b08396575d1a0786e5d48c8d9556b428eea8070935fabd1e838204e6c953459206d3a0d5d38c8e95a6f187f996d6eacad40ce53186ba70f261221d3b981080b37b7503b75c8c27132753ba8a310ce94c1930cc614eae0c0c2aec55092d5985ad2c4ae3672a2fee1a75f7f33a4bf78a86deb5085f3f3bba9f203bfdf34a74247394f3cfef09d333c93a9eaf4ec622903aa93f18ce2755cf903ac45c763f14ed499409d2d06ea37da1308a2d176a3a3034e00b96f10ceb6415a1be3d681dcaf99e5f7652b6a10907290f381bc707b412a2c2b3a5e96c3821a9bfcbfd5d73cdff546defd095f5bfad11367c71ebaa1e59f55275d75eabccb7f6c7ae44265f6af8d077e9d76f3f72c68296ddcbc5bb433628b7f7184ad2bb8797feaa6f57f1f99960ff96936bf9681fc5da613d6cc5c2accc8cc803fd151b649f8595e77264c36fdfcd4423ef36b98a398185543fe20a30585e3dfa064f056d15dcb34d7f7c6947ba16bb154553b989ce93842080a0e33a9f5111b2d984f5320cf8e828613a1907fbb27b0d4f4068e585128ee27d85db382c037bd2e0405a7825453ab43c1b920e9b53a48d02dcdb278b426e31f9bd1945a5741b371003a5bd65ac9678d75c6127194e836da9b8f257a382e66f1b99778b3d68449f7d90bc621cb860579044cb7f924cb2164bb13b55ec4d14834c963471b0bb4e2a241d3250f7cbb3260fe843fe113875f3368ce48b4b08da6b001bbf03cf60c259670f956cd54937063749d3f8e2fbc3f4d8f6dfc71d7995eaedb4038ba7103e1fe8d29f1b57a9a1b5bf8754209aba46013220a119efcb0381e97c22771a1d67f9cd46a1064daa9a97977dc66ac1ba588a92e53acf3262ebac23df10afdfa8f90f2c29da77ff2bed91ceaff4b532d2104458ee3edd26d27b6c9ff0a299529149d59a7eef02d93f5297d654cbae27a26ad88e7689e74549ac4130c93ffc7153b594484d8fc18bbddde28c39ec63cc27be4026af13ea98c98bcc74a4936fec55c54980f1ccaa98cf0da8c423eb910209ca29beae21dead9b16d7bd596d461fe6473a95a469c7a4a0a8b4961fcb26c1e08d72cce76b95382e6b1df283ced253cddb3f0a612441970c54d6fa8b80ba4db6b75108f2cc2a780dcd0acb4c382502427987931b9e2ee00e245752a881791868837b487af0157523ca50ab134dbb621f41ae2b3475abb941e6a585f68f37fa15ca8593a0eca7509eff14e63a7616af1010b70929bea314f2d4bf16272015d2a2ec7a6469d0cd7f701e6b175fe81af2e143b80f4429d0ad20b1ceb597a4f09720430e5edd064b26bd7e647953aed752ac8ed5822326d1777c3b4f96c2d5e4abc6eb86c0c2df50a2ded39b45909a10198a5d0654bef0b84f01b55caa2dc10a0fa5ef77dc7ff2a41590d33ad3409201394ee75f654506eaa99a04c5676bfd4cbad6066e34ef6332f283fd779208c6a268451856d89d751219c5eabab109eefb96a095bfc9dee01822ed50c482daae5905a33f63f653f40530761a8a8a7ed5cb39d0b3e9f2e6dacc240df29f04a4b98046729223388021e1014a3ca4948ae914b6cf05878be1a9e37727d221d817ad19e8b193e140cf5228b0bb3a2baa6975006105250fe9cffc1e4770a6e72f0f0b9a078b08150294c1da849b841c0a323b03984379b4964586aed5b6fed1ca82daf68915ee022cf30752ea689002f166d37b45137b814c834a433c0452723e41436ea5c9dc3c574f37b4af2f9570a1e8f74ee526d5749d5a5575cad6eb73786544730904d23220a7aa4d3e1dfe8358cfb54632223812c577f1ffffa70e7291afcfdead78ddb0eed78a9eeaaed5a777cf9f71583ab4fa7bc6586f4d066bf9048bf4a113e13a7fc576d4fbd78e8ffd8bd2577f7fdfebdf7475a1159b263e596a9bc2675435c45c6738fb2aaece427f7cd0377d6d7ef9e4c793c7421efb07df1c3c2b8572f52723a7b950bfbf70200000000000000000000000000000000000000000000"
    console.log(q.length)
    // 7882

    console.log(
      'tx gas used',
      eg1.toString(),
      l1GasUsed1.toString(),
      totalGasUsed1.sub(l1GasUsed1).toString(),
      totalGasUsed1.toString(),
      totalGasUsed1.mul(eg1).toString(),
      l1Gas
    )

    const feeData1 = await l1Signer.provider!.getFeeData()
    const feeData2 = await l2Signer.provider!.getFeeData()

    const gp1 = await l1Signer.provider!.getGasPrice()
    const gp2 = await l2Signer.provider!.getGasPrice()

    const bn = await l1Signer.provider!.getBlockNumber()

    const effectiveGasPrice =  "0x08"

    // 1l estimated cost = l1 bytes * l1 byte cost * l1 base fee estimate * ratio
    // in l2 gas = l1 estimated cost / l2 gas price

    // (l1 gas used * effective gas price) / (16 * l1 base fee ) = l1 bytes

    // (337236 * 1600000000) / (16 * 8)
    
    

    while(true) {
      
      const transactions =  (await l1Signer.provider!.getBlockWithTransactions("latest"))?.transactions
      console.log(transactions)
      if(transactions.length > 0) {
        const receipt = await l1Signer.provider!.getTransactionReceipt(transactions[0].hash)
        console.log(receipt.gasUsed.toString(), receipt.effectiveGasPrice.toString(), receipt)
        break;
      }
      
      await wait(1000)

    }

    console.log(
      'feedata 1',
      feeData1.maxFeePerGas!.toString(),
      feeData1.maxPriorityFeePerGas!.toString(),
      feeData1.gasPrice?.toString(),
      gp1.toString(),
      (await l1Signer.provider!.getBlock('latest'))?.baseFeePerGas?.toNumber()
    )
    console.log(
      'feedata 2',
      feeData2.maxFeePerGas!.toString(),
      feeData2.maxPriorityFeePerGas!.toString(),
      feeData2.gasPrice?.toString(),
      gp2.toString(),
      (await l2Signer.provider!.getBlock('latest'))?.baseFeePerGas?.toNumber()
    )
  })

  it('transfers ether on l2', async () => {
    const { l2Signer } = await instantiateBridgeWithRandomWallet()

    await fundL2(l2Signer)
    const randomAddress = Wallet.createRandom().address
    const amountToSend = parseEther('0.000005')

    const balanceBefore = await l2Signer.provider!.getBalance(
      await l2Signer.getAddress()
    )

    const rec = await (
      await l2Signer.sendTransaction({
        to: randomAddress,
        value: amountToSend,
        maxFeePerGas: 15000000000,
        maxPriorityFeePerGas: 0,
      })
    ).wait()

    const balanceAfter = await l2Signer.provider!.getBalance(
      await l2Signer.getAddress()
    )
    const randomBalanceAfter = await l2Signer.provider!.getBalance(
      randomAddress
    )
    expect(randomBalanceAfter.toString(), 'random address balance after').to.eq(
      amountToSend.toString()
    )
    expect(balanceAfter.toString(), 'l2 balance after').to.eq(
      balanceBefore
        .sub(rec.gasUsed.mul(rec.effectiveGasPrice))
        .sub(amountToSend)
        .toString()
    )
  })
  it('deposits ether', async () => {
    const {
      ethBridger,
      l1Signer,
      l2Signer,
    } = await instantiateBridgeWithRandomWallet()

    await fundL1(l1Signer)
    const inboxAddress = ethBridger.l2Network.ethBridge.inbox

    const initialInboxBalance = await l1Signer.provider!.getBalance(
      inboxAddress
    )
    const ethToDeposit = parseEther('0.0002')
    const res = await ethBridger.deposit({
      amount: ethToDeposit,
      l1Signer: l1Signer,
      l2Provider: l2Signer.provider!,
    })
    const rec = await res.wait()

    expect(rec.status).to.equal(1, 'eth deposit L1 txn failed')
    const finalInboxBalance = await l1Signer.provider!.getBalance(inboxAddress)
    expect(
      initialInboxBalance.add(ethToDeposit).eq(finalInboxBalance),
      'balance failed to update after eth deposit'
    )

    const waitResult = await rec.waitForL2(l2Signer.provider!)

    prettyLog('l2TxHash: ' + waitResult.message.retryableCreationId)
    prettyLog('l2 transaction found!')
    expect(waitResult.complete).to.eq(true, 'eth deposit not complete')
    expect(waitResult.status).to.eq(
      L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2,
      'eth deposit l2 transaction not found'
    )

    const testWalletL2EthBalance = await l2Signer.getBalance()
    expect(testWalletL2EthBalance.gt(ethToDeposit), 'final balance').to.be.true
  })

  // CHRIS: TODO: remove
  const getOutboxData = () => {
    // 1. send the withdrawal transaction
    // 2. look for the L2toL1Transaction event
    // 3. this should contain the block hash - use this getBlock()
    // 4. the mix hash of the block contains the the sendsRoot
    // 5. Using the send root and the index, form the path? how is that done? need all the sends
  }

  it('withdraw Ether transaction succeeds', async () => {
    const {
      l2Network,
      l2Signer,
      l1Signer,
      ethBridger,
    } = await instantiateBridgeWithRandomWallet()
    await fundL2(l2Signer)
    const ethToWithdraw = parseEther('0.00002')
    const initialBalance = await l2Signer.getBalance()

    const withdrawEthRes = await ethBridger.withdraw({
      amount: ethToWithdraw,
      l2Signer: l2Signer,
    })
    const withdrawEthRec = await withdrawEthRes.wait()

    const arbGasInfo = ArbGasInfo__factory.connect(
      ARB_GAS_INFO,
      l2Signer.provider!
    )
    expect(withdrawEthRec.status).to.equal(
      1,
      'initiate eth withdraw txn failed'
    )

    const inWei = await arbGasInfo.getPricesInWei({
      blockTag: withdrawEthRec.blockNumber,
    })

    const withdrawMessage = (
      await withdrawEthRec.getL2ToL1Messages(l1Signer.provider!, l2Network)
    )[0]
    expect(
      withdrawMessage,
      'eth withdraw getWithdrawalsInL2Transaction query came back empty'
    ).to.exist

    const myAddress = await l1Signer.getAddress()
    const withdrawEvents = await L2ToL1Message.getL2ToL1MessageLogs(
      l2Signer.provider!,
      { fromBlock: withdrawEthRec.blockNumber, toBlock: 'latest' },
      undefined,
      myAddress
    )

    expect(withdrawEvents.length).to.equal(
      1,
      'eth withdraw getL2ToL1EventData failed'
    )
    return
    // CHRIS: TODO: below we need to look for the outbox entry

    const messageStatus = await withdrawMessage.status(
      null,
      withdrawEthRec.blockHash
    )
    expect(
      messageStatus,
      `eth withdraw status returned ${messageStatus}`
    ).to.be.eq(L2ToL1MessageStatus.UNCONFIRMED)

    const etherBalance = await l2Signer.getBalance()
    const totalEth = etherBalance
      .add(ethToWithdraw)
      .add(withdrawEthRec.gasUsed.mul(inWei[5]))

    // TODO
    console.log(
      `This number should be zero...? ${initialBalance
        .sub(totalEth)
        .toString()}`
    )

    expect(true).to.be.true
  })
})
