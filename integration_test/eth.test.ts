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
import { Zero } from '@ethersproject/constants'
import { parseEther } from '@ethersproject/units'

import { ArbGasInfo__factory } from '../src/lib/abi/factories/ArbGasInfo__factory'
import {
  instantiateBridgeWithRandomWallet,
  fundL1,
  wait,
  fundL2,
  prettyLog,
  skipIfMainnet,
  fundL22,
} from './testHelpers'
import { ARB_GAS_INFO } from '../src/lib/dataEntities/constants'
import {
  L2ToL1Message,
  L2ToL1MessageStatus,
} from '../src/lib/message/L2ToL1Message'
import { L1ToL2MessageStatus } from '../src/lib/message/L1ToL2Message'
import { Provider } from '@ethersproject/abstract-provider'
import { BaseProvider, JsonRpcProvider } from '@ethersproject/providers'
import * as ArbProvider from '../src/lib/utils/arbProvider'
import { BigNumber, ethers } from 'ethers'
dotenv.config()

describe('Ether', async () => {
  beforeEach('skipIfMainnet', async function () {
    await skipIfMainnet(this)
  })

  // CHRIS: TODO: remove
  it('deploy', async () => {
    const { l1Network, l2Network } = await instantiateBridgeWithRandomWallet()
    console.log('l1network', l1Network)
    console.log('l2network', l2Network)
  })

  // CHRIS: TODO: remove
  // it.only('check previous block hashes', async () => {
  //   const bytecode = {
  //     functionDebugData: {},
  //     generatedSources: [],
  //     linkReferences: {},
  //     object:
  //       '608060405260646000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555034801561005157600080fd5b50610566806100616000396000f3fe608060405234801561001057600080fd5b50600436106100625760003560e01c806339cc42641461006757806342cbb15c146100975780637ca3d498146100b5578063ca71fce7146100d3578063dd848c6b146100f1578063ee82ac5e1461010f575b600080fd5b610081600480360381019061007c919061040a565b61013f565b60405161008e9190610450565b60405180910390f35b61009f6101e3565b6040516100ac919061047a565b60405180910390f35b6100bd6101eb565b6040516100ca9190610450565b60405180910390f35b6100db6101f9565b6040516100e89190610450565b60405180910390f35b6100f961032d565b604051610106919061047a565b60405180910390f35b6101296004803603810190610124919061040a565b6103c4565b6040516101369190610450565b60405180910390f35b60008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16632b407a82836040518263ffffffff1660e01b815260040161019b919061047a565b602060405180830381865afa1580156101b8573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906101dc91906104c1565b9050919050565b600043905090565b600080439050804091505090565b60008060008054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663a3b1b31d6040518163ffffffff1660e01b8152600401602060405180830381865afa158015610267573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061028b9190610503565b905060008054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16632b407a82826040518263ffffffff1660e01b81526004016102e6919061047a565b602060405180830381865afa158015610303573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061032791906104c1565b91505090565b60008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1663a3b1b31d6040518163ffffffff1660e01b8152600401602060405180830381865afa15801561039b573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906103bf9190610503565b905090565b600081409050919050565b600080fd5b6000819050919050565b6103e7816103d4565b81146103f257600080fd5b50565b600081359050610404816103de565b92915050565b6000602082840312156104205761041f6103cf565b5b600061042e848285016103f5565b91505092915050565b6000819050919050565b61044a81610437565b82525050565b60006020820190506104656000830184610441565b92915050565b610474816103d4565b82525050565b600060208201905061048f600083018461046b565b92915050565b61049e81610437565b81146104a957600080fd5b50565b6000815190506104bb81610495565b92915050565b6000602082840312156104d7576104d66103cf565b5b60006104e5848285016104ac565b91505092915050565b6000815190506104fd816103de565b92915050565b600060208284031215610519576105186103cf565b5b6000610527848285016104ee565b9150509291505056fea2646970667358221220f157752cf02e010c4b610c5f6db97605db669208a16bb008ea2f35f88d2d98a764736f6c634300080c0033',
  //     opcodes:
  //       'PUSH1 0x80 PUSH1 0x40 MSTORE PUSH1 0x64 PUSH1 0x0 DUP1 PUSH2 0x100 EXP DUP2 SLOAD DUP2 PUSH20 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF MUL NOT AND SWAP1 DUP4 PUSH20 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF AND MUL OR SWAP1 SSTORE POP CALLVALUE DUP1 ISZERO PUSH2 0x51 JUMPI PUSH1 0x0 DUP1 REVERT JUMPDEST POP PUSH2 0x566 DUP1 PUSH2 0x61 PUSH1 0x0 CODECOPY PUSH1 0x0 RETURN INVALID PUSH1 0x80 PUSH1 0x40 MSTORE CALLVALUE DUP1 ISZERO PUSH2 0x10 JUMPI PUSH1 0x0 DUP1 REVERT JUMPDEST POP PUSH1 0x4 CALLDATASIZE LT PUSH2 0x62 JUMPI PUSH1 0x0 CALLDATALOAD PUSH1 0xE0 SHR DUP1 PUSH4 0x39CC4264 EQ PUSH2 0x67 JUMPI DUP1 PUSH4 0x42CBB15C EQ PUSH2 0x97 JUMPI DUP1 PUSH4 0x7CA3D498 EQ PUSH2 0xB5 JUMPI DUP1 PUSH4 0xCA71FCE7 EQ PUSH2 0xD3 JUMPI DUP1 PUSH4 0xDD848C6B EQ PUSH2 0xF1 JUMPI DUP1 PUSH4 0xEE82AC5E EQ PUSH2 0x10F JUMPI JUMPDEST PUSH1 0x0 DUP1 REVERT JUMPDEST PUSH2 0x81 PUSH1 0x4 DUP1 CALLDATASIZE SUB DUP2 ADD SWAP1 PUSH2 0x7C SWAP2 SWAP1 PUSH2 0x40A JUMP JUMPDEST PUSH2 0x13F JUMP JUMPDEST PUSH1 0x40 MLOAD PUSH2 0x8E SWAP2 SWAP1 PUSH2 0x450 JUMP JUMPDEST PUSH1 0x40 MLOAD DUP1 SWAP2 SUB SWAP1 RETURN JUMPDEST PUSH2 0x9F PUSH2 0x1E3 JUMP JUMPDEST PUSH1 0x40 MLOAD PUSH2 0xAC SWAP2 SWAP1 PUSH2 0x47A JUMP JUMPDEST PUSH1 0x40 MLOAD DUP1 SWAP2 SUB SWAP1 RETURN JUMPDEST PUSH2 0xBD PUSH2 0x1EB JUMP JUMPDEST PUSH1 0x40 MLOAD PUSH2 0xCA SWAP2 SWAP1 PUSH2 0x450 JUMP JUMPDEST PUSH1 0x40 MLOAD DUP1 SWAP2 SUB SWAP1 RETURN JUMPDEST PUSH2 0xDB PUSH2 0x1F9 JUMP JUMPDEST PUSH1 0x40 MLOAD PUSH2 0xE8 SWAP2 SWAP1 PUSH2 0x450 JUMP JUMPDEST PUSH1 0x40 MLOAD DUP1 SWAP2 SUB SWAP1 RETURN JUMPDEST PUSH2 0xF9 PUSH2 0x32D JUMP JUMPDEST PUSH1 0x40 MLOAD PUSH2 0x106 SWAP2 SWAP1 PUSH2 0x47A JUMP JUMPDEST PUSH1 0x40 MLOAD DUP1 SWAP2 SUB SWAP1 RETURN JUMPDEST PUSH2 0x129 PUSH1 0x4 DUP1 CALLDATASIZE SUB DUP2 ADD SWAP1 PUSH2 0x124 SWAP2 SWAP1 PUSH2 0x40A JUMP JUMPDEST PUSH2 0x3C4 JUMP JUMPDEST PUSH1 0x40 MLOAD PUSH2 0x136 SWAP2 SWAP1 PUSH2 0x450 JUMP JUMPDEST PUSH1 0x40 MLOAD DUP1 SWAP2 SUB SWAP1 RETURN JUMPDEST PUSH1 0x0 DUP1 PUSH1 0x0 SWAP1 SLOAD SWAP1 PUSH2 0x100 EXP SWAP1 DIV PUSH20 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF AND PUSH20 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF AND PUSH4 0x2B407A82 DUP4 PUSH1 0x40 MLOAD DUP3 PUSH4 0xFFFFFFFF AND PUSH1 0xE0 SHL DUP2 MSTORE PUSH1 0x4 ADD PUSH2 0x19B SWAP2 SWAP1 PUSH2 0x47A JUMP JUMPDEST PUSH1 0x20 PUSH1 0x40 MLOAD DUP1 DUP4 SUB DUP2 DUP7 GAS STATICCALL ISZERO DUP1 ISZERO PUSH2 0x1B8 JUMPI RETURNDATASIZE PUSH1 0x0 DUP1 RETURNDATACOPY RETURNDATASIZE PUSH1 0x0 REVERT JUMPDEST POP POP POP POP PUSH1 0x40 MLOAD RETURNDATASIZE PUSH1 0x1F NOT PUSH1 0x1F DUP3 ADD AND DUP3 ADD DUP1 PUSH1 0x40 MSTORE POP DUP2 ADD SWAP1 PUSH2 0x1DC SWAP2 SWAP1 PUSH2 0x4C1 JUMP JUMPDEST SWAP1 POP SWAP2 SWAP1 POP JUMP JUMPDEST PUSH1 0x0 NUMBER SWAP1 POP SWAP1 JUMP JUMPDEST PUSH1 0x0 DUP1 NUMBER SWAP1 POP DUP1 BLOCKHASH SWAP2 POP POP SWAP1 JUMP JUMPDEST PUSH1 0x0 DUP1 PUSH1 0x0 DUP1 SLOAD SWAP1 PUSH2 0x100 EXP SWAP1 DIV PUSH20 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF AND PUSH20 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF AND PUSH4 0xA3B1B31D PUSH1 0x40 MLOAD DUP2 PUSH4 0xFFFFFFFF AND PUSH1 0xE0 SHL DUP2 MSTORE PUSH1 0x4 ADD PUSH1 0x20 PUSH1 0x40 MLOAD DUP1 DUP4 SUB DUP2 DUP7 GAS STATICCALL ISZERO DUP1 ISZERO PUSH2 0x267 JUMPI RETURNDATASIZE PUSH1 0x0 DUP1 RETURNDATACOPY RETURNDATASIZE PUSH1 0x0 REVERT JUMPDEST POP POP POP POP PUSH1 0x40 MLOAD RETURNDATASIZE PUSH1 0x1F NOT PUSH1 0x1F DUP3 ADD AND DUP3 ADD DUP1 PUSH1 0x40 MSTORE POP DUP2 ADD SWAP1 PUSH2 0x28B SWAP2 SWAP1 PUSH2 0x503 JUMP JUMPDEST SWAP1 POP PUSH1 0x0 DUP1 SLOAD SWAP1 PUSH2 0x100 EXP SWAP1 DIV PUSH20 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF AND PUSH20 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF AND PUSH4 0x2B407A82 DUP3 PUSH1 0x40 MLOAD DUP3 PUSH4 0xFFFFFFFF AND PUSH1 0xE0 SHL DUP2 MSTORE PUSH1 0x4 ADD PUSH2 0x2E6 SWAP2 SWAP1 PUSH2 0x47A JUMP JUMPDEST PUSH1 0x20 PUSH1 0x40 MLOAD DUP1 DUP4 SUB DUP2 DUP7 GAS STATICCALL ISZERO DUP1 ISZERO PUSH2 0x303 JUMPI RETURNDATASIZE PUSH1 0x0 DUP1 RETURNDATACOPY RETURNDATASIZE PUSH1 0x0 REVERT JUMPDEST POP POP POP POP PUSH1 0x40 MLOAD RETURNDATASIZE PUSH1 0x1F NOT PUSH1 0x1F DUP3 ADD AND DUP3 ADD DUP1 PUSH1 0x40 MSTORE POP DUP2 ADD SWAP1 PUSH2 0x327 SWAP2 SWAP1 PUSH2 0x4C1 JUMP JUMPDEST SWAP2 POP POP SWAP1 JUMP JUMPDEST PUSH1 0x0 DUP1 PUSH1 0x0 SWAP1 SLOAD SWAP1 PUSH2 0x100 EXP SWAP1 DIV PUSH20 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF AND PUSH20 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF AND PUSH4 0xA3B1B31D PUSH1 0x40 MLOAD DUP2 PUSH4 0xFFFFFFFF AND PUSH1 0xE0 SHL DUP2 MSTORE PUSH1 0x4 ADD PUSH1 0x20 PUSH1 0x40 MLOAD DUP1 DUP4 SUB DUP2 DUP7 GAS STATICCALL ISZERO DUP1 ISZERO PUSH2 0x39B JUMPI RETURNDATASIZE PUSH1 0x0 DUP1 RETURNDATACOPY RETURNDATASIZE PUSH1 0x0 REVERT JUMPDEST POP POP POP POP PUSH1 0x40 MLOAD RETURNDATASIZE PUSH1 0x1F NOT PUSH1 0x1F DUP3 ADD AND DUP3 ADD DUP1 PUSH1 0x40 MSTORE POP DUP2 ADD SWAP1 PUSH2 0x3BF SWAP2 SWAP1 PUSH2 0x503 JUMP JUMPDEST SWAP1 POP SWAP1 JUMP JUMPDEST PUSH1 0x0 DUP2 BLOCKHASH SWAP1 POP SWAP2 SWAP1 POP JUMP JUMPDEST PUSH1 0x0 DUP1 REVERT JUMPDEST PUSH1 0x0 DUP2 SWAP1 POP SWAP2 SWAP1 POP JUMP JUMPDEST PUSH2 0x3E7 DUP2 PUSH2 0x3D4 JUMP JUMPDEST DUP2 EQ PUSH2 0x3F2 JUMPI PUSH1 0x0 DUP1 REVERT JUMPDEST POP JUMP JUMPDEST PUSH1 0x0 DUP2 CALLDATALOAD SWAP1 POP PUSH2 0x404 DUP2 PUSH2 0x3DE JUMP JUMPDEST SWAP3 SWAP2 POP POP JUMP JUMPDEST PUSH1 0x0 PUSH1 0x20 DUP3 DUP5 SUB SLT ISZERO PUSH2 0x420 JUMPI PUSH2 0x41F PUSH2 0x3CF JUMP JUMPDEST JUMPDEST PUSH1 0x0 PUSH2 0x42E DUP5 DUP3 DUP6 ADD PUSH2 0x3F5 JUMP JUMPDEST SWAP2 POP POP SWAP3 SWAP2 POP POP JUMP JUMPDEST PUSH1 0x0 DUP2 SWAP1 POP SWAP2 SWAP1 POP JUMP JUMPDEST PUSH2 0x44A DUP2 PUSH2 0x437 JUMP JUMPDEST DUP3 MSTORE POP POP JUMP JUMPDEST PUSH1 0x0 PUSH1 0x20 DUP3 ADD SWAP1 POP PUSH2 0x465 PUSH1 0x0 DUP4 ADD DUP5 PUSH2 0x441 JUMP JUMPDEST SWAP3 SWAP2 POP POP JUMP JUMPDEST PUSH2 0x474 DUP2 PUSH2 0x3D4 JUMP JUMPDEST DUP3 MSTORE POP POP JUMP JUMPDEST PUSH1 0x0 PUSH1 0x20 DUP3 ADD SWAP1 POP PUSH2 0x48F PUSH1 0x0 DUP4 ADD DUP5 PUSH2 0x46B JUMP JUMPDEST SWAP3 SWAP2 POP POP JUMP JUMPDEST PUSH2 0x49E DUP2 PUSH2 0x437 JUMP JUMPDEST DUP2 EQ PUSH2 0x4A9 JUMPI PUSH1 0x0 DUP1 REVERT JUMPDEST POP JUMP JUMPDEST PUSH1 0x0 DUP2 MLOAD SWAP1 POP PUSH2 0x4BB DUP2 PUSH2 0x495 JUMP JUMPDEST SWAP3 SWAP2 POP POP JUMP JUMPDEST PUSH1 0x0 PUSH1 0x20 DUP3 DUP5 SUB SLT ISZERO PUSH2 0x4D7 JUMPI PUSH2 0x4D6 PUSH2 0x3CF JUMP JUMPDEST JUMPDEST PUSH1 0x0 PUSH2 0x4E5 DUP5 DUP3 DUP6 ADD PUSH2 0x4AC JUMP JUMPDEST SWAP2 POP POP SWAP3 SWAP2 POP POP JUMP JUMPDEST PUSH1 0x0 DUP2 MLOAD SWAP1 POP PUSH2 0x4FD DUP2 PUSH2 0x3DE JUMP JUMPDEST SWAP3 SWAP2 POP POP JUMP JUMPDEST PUSH1 0x0 PUSH1 0x20 DUP3 DUP5 SUB SLT ISZERO PUSH2 0x519 JUMPI PUSH2 0x518 PUSH2 0x3CF JUMP JUMPDEST JUMPDEST PUSH1 0x0 PUSH2 0x527 DUP5 DUP3 DUP6 ADD PUSH2 0x4EE JUMP JUMPDEST SWAP2 POP POP SWAP3 SWAP2 POP POP JUMP INVALID LOG2 PUSH5 0x6970667358 0x22 SLT KECCAK256 CALL JUMPI PUSH22 0x2CF02E010C4B610C5F6DB97605DB669208A16BB008EA 0x2F CALLDATALOAD 0xF8 DUP14 0x2D SWAP9 0xA7 PUSH5 0x736F6C6343 STOP ADDMOD 0xC STOP CALLER ',
  //     sourceMap:
  //       '550:837:0:-:0;;;611:3;580:36;;;;;;;;;;;;;;;;;;;;550:837;;;;;;;;;;;;;;;;',
  //   }
  //   const abi = [
  //     {
  //       inputs: [
  //         {
  //           internalType: 'uint256',
  //           name: 'arbBlockNum',
  //           type: 'uint256',
  //         },
  //       ],
  //       name: 'getArbBlockHash',
  //       outputs: [
  //         {
  //           internalType: 'bytes32',
  //           name: '',
  //           type: 'bytes32',
  //         },
  //       ],
  //       stateMutability: 'view',
  //       type: 'function',
  //     },
  //     {
  //       inputs: [],
  //       name: 'getArbBlockNumber',
  //       outputs: [
  //         {
  //           internalType: 'uint256',
  //           name: '',
  //           type: 'uint256',
  //         },
  //       ],
  //       stateMutability: 'view',
  //       type: 'function',
  //     },
  //     {
  //       inputs: [
  //         {
  //           internalType: 'uint256',
  //           name: 'blockNum',
  //           type: 'uint256',
  //         },
  //       ],
  //       name: 'getBlockHash',
  //       outputs: [
  //         {
  //           internalType: 'bytes32',
  //           name: '',
  //           type: 'bytes32',
  //         },
  //       ],
  //       stateMutability: 'view',
  //       type: 'function',
  //     },
  //     {
  //       inputs: [],
  //       name: 'getBlockNumber',
  //       outputs: [
  //         {
  //           internalType: 'uint256',
  //           name: '',
  //           type: 'uint256',
  //         },
  //       ],
  //       stateMutability: 'view',
  //       type: 'function',
  //     },
  //     {
  //       inputs: [],
  //       name: 'getCurrentArbBlockHash',
  //       outputs: [
  //         {
  //           internalType: 'bytes32',
  //           name: '',
  //           type: 'bytes32',
  //         },
  //       ],
  //       stateMutability: 'view',
  //       type: 'function',
  //     },
  //     {
  //       inputs: [],
  //       name: 'getCurrentBlockHash',
  //       outputs: [
  //         {
  //           internalType: 'bytes32',
  //           name: '',
  //           type: 'bytes32',
  //         },
  //       ],
  //       stateMutability: 'view',
  //       type: 'function',
  //     },
  //   ]

  //   const { l2Signer, l1Signer } = await instantiateBridgeWithRandomWallet()
  //   await fundL2(l2Signer)

  //   // const arbTesterContract = new ethers.ContractFactory(abi, bytecode, l2Signer)
  //   // const contract = await arbTesterContract.deploy()
  //   // console.log("c", contract.address);
  //   const addr = '0x48bAC0260736df785f116Fa03bfCDD08bC2770Be'
  //   const arbTesterContract = await ethers.ContractFactory.getContract(
  //     addr,
  //     abi,
  //     l2Signer
  //   )

  //   const number: BigNumber = await arbTesterContract['getArbBlockNumber']()
  //   const number2: BigNumber = await arbTesterContract['getBlockNumber']()
  //   const blockHash = await arbTesterContract['getArbBlockHash'](number.sub(1))
  //   const blockHashFromOpcode = await await arbTesterContract['getBlockHash'](
  //     number.sub(10)
  //   )
  //   console.log(number.toString(), number2.toString())

  //   let i = 0
  //   for (
  //     let index = number.toNumber() -1;
  //     index > number.toNumber() - 256;
  //     index--
  //   ) {
  //     try {
  //       i++
  //       const blockHashPrecompile = await arbTesterContract['getArbBlockHash'](
  //         index
  //       )
  //       const l1BlockHash = (await l1Signer.provider!.getBlock(index)).hash
  //       const l2BlockHash = (await l2Signer.provider!.getBlock(index)).hash

  //       if (
  //         blockHashFromOpcode === blockHashPrecompile ||
  //         blockHashFromOpcode === l1BlockHash ||
  //         blockHashFromOpcode === l2BlockHash
  //       ) {
  //         console.log(
  //           'YAYYYY',
  //           index,
  //           blockHashFromOpcode,
  //           blockHashPrecompile,
  //           l1BlockHash,
  //           l2BlockHash
  //         )
  //       }
  //     } catch (err) {
  //       console.log(number.toNumber(), index, i)
  //       throw err
  //     }
  //   }

  //   const blockHash2 = await arbTesterContract['getBlockHash'](number.sub(1))
  //   const blockHash3 = await arbTesterContract['getArbBlockHash'](number.sub(1))
  //   // const currentBlockHash = await arbTesterContract["getCurrentArbBlockHash"]();
  //   // const currentBlockHash2 = await arbTesterContract["getCurrentBlockHash"]();

  //   console.log(
  //     i,
  //     number.toString(),
  //     number2.toString(),
  //     (await l2Signer.provider!.getBlockNumber()).toString(),
  //     blockHash,
  //     blockHash2,
  //     blockHash3
  //     // currentBlockHash2
  //     // currentBlockHash
  //   )

  //   const txRec = await l2Signer.provider!.getTransactionReceipt(
  //     '0x1a70f57b69d597bd44f03e436cda18adb0f10d526f0f110439e27625456104c4'
  //   )
  //   console.log(txRec)

  //   const testAddr = '0xd8b934580fcE35a11B58C6D73aDeE468a2833fa8'

  //   await fundL22(
  //     '0x5cA3E9aFc11D1A29A81f9Ed6C95e940b139853aB',
  //     l2Signer.provider!
  //   )

  //   const code = await l2Signer.provider!.getCode(testAddr)
  //   console.log(code)

  //   // 1. deploy a contract with functions for returning block values
  // })

  it.only('transfers ether on l2', async () => {
    const { l2Signer, l1Signer } = await instantiateBridgeWithRandomWallet()

    await fundL2(l2Signer)
    const randomAddress = Wallet.createRandom().address
    const amountToSend = parseEther('0.000005')
    const gasEstimate = await l2Signer.provider!.estimateGas({
      to: randomAddress,
      value: amountToSend,
    })

    const balanceBefore = await l2Signer.provider!.getBalance(
      await l2Signer.getAddress()
    )
    // CHRIS: TODO: tidy logs up below and above
    console.log('bal before', balanceBefore.toString())
    console.log("l1 gas price", await (await l1Signer.provider!.getGasPrice()).toString())

    const res = await (await l2Signer.sendTransaction({
      to: randomAddress,
      value: amountToSend,
      maxFeePerGas: 15000000000,
      maxPriorityFeePerGas: 0,
      // gasPrice: 15000000000
    })).wait()

    const rec2 = await (await l2Signer.sendTransaction({
      to: randomAddress,
      value: amountToSend,
      gasPrice: 15000000000
    })).wait()
    

    // // console.log("tx", res.gasPrice?.toString(), res.maxFeePerGas?.toString(), res.maxPriorityFeePerGas?.toString())

    // // const rec = await res.wait()
    // // const q = await (l2Signer.provider! as JsonRpcProvider).send("eth_getTransactionReceipt", [
    // //   rec.transactionHash

    // // ])
    // // console.log(q)


    // console.log(
    //   'gas price',
    //   await (await l2Signer.provider!.getGasPrice()).toString()
    // )


    
    // console.log(
    //   'rec gas',
    //   rec.gasUsed.toString(),
    //   rec.effectiveGasPrice.toString(),
    //   rec.gasUsed.mul(rec.effectiveGasPrice).toString(),
    //   BigNumber.from(q["l1GasUsed"]).toString(),
    //   BigNumber.from(q["l1GasUsed"]).mul(rec.effectiveGasPrice).toString(),
    //   )
    //   console.log("rec2", rec2.gasUsed.toString(), rec.effectiveGasPrice.toString())

    const balanceAfter = await l2Signer.provider!.getBalance(
      await l2Signer.getAddress()
    )
    console.log(
      'bal after',
      balanceAfter.toString(),
      balanceBefore.sub(balanceAfter).toString(),
      balanceBefore
        .sub(balanceAfter)
        // .sub(rec.gasUsed.mul(rec.effectiveGasPrice))
        .sub(amountToSend)
        .toString()
    )

    // const arbTxRec = await ArbProvider.getRawArbTransactionReceipt(
    //   l2Signer.provider! as JsonRpcProvider,
    //   rec.transactionHash
    // )
    // //  const w = await (l2Signer.provider! as JsonRpcProvider).send(
    // //    "eth_getTransactionReceipt", [
    // //      rec.transactionHash
    // //    ]
    // //  )
    //  console.log(arbTxRec )

    // expect(rec.status).to.equal(1, 'ether transfer failed')
    // const newBalance = await l2Signer.provider!.getBalance(randomAddress)
    // expect(newBalance.eq(amountToSend), "ether balance didn't update").to.be
    //   .true
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

    console.log(
      'ticket creation id',
      (await rec.getL1ToL2Message(l2Signer)).retryableCreationId
    )
    // CHRIS: TODO: remove
    // const curBlock = await l2Signer.provider!.getBlockNumber()
    // console.log(
    //   await l2Signer.provider!.getLogs({
    //     fromBlock: curBlock - 50,
    //     toBlock: curBlock,
    //   })
    // )
    // console.log('BOOOOMMMMM')
    // console.log(rec.logs)

    const waitResult = await rec.waitForL2(l2Signer.provider!)

    prettyLog('l2TxHash: ' + waitResult.message.retryableCreationId)
    prettyLog('l2 transaction found!')
    expect(waitResult.complete).to.eq(true, 'eth deposit not complete')
    expect(waitResult.status).to.eq(
      L1ToL2MessageStatus.FUNDS_DEPOSITED_ON_L2,
      'eth deposit l2 transaction not found'
    )

    for (let i = 0; i < 60; i++) {
      prettyLog('balance check attempt ' + (i + 1))
      await wait(5000)
      const testWalletL2EthBalance = await l2Signer.getBalance()
      if (testWalletL2EthBalance.gt(Zero)) {
        prettyLog(`balance updated!  ${testWalletL2EthBalance.toString()}`)
        expect(true).to.be.true
        break
      }
    }
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
