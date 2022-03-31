/*
 * Copyright 2022, Offchain Labs, Inc.
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
import '@nomiclabs/hardhat-ethers'
import chai, { assert } from "chai";
import { expect } from 'chai'
import { Wallet } from '@ethersproject/wallet'
import { ethers } from 'hardhat'
import { formatBytes32String } from 'ethers/lib/utils'
import { solidity } from "ethereum-waffle";
chai.use(solidity);

describe('Nitro', async () => {
  
    it('Can Deploy NitroTest', async () => {
      const [ signer ] = await ethers.getSigners();
      
      const Factory = await ethers.getContractFactory('NitroTest')
      const deployGasEstimate = await ethers.provider.estimateGas(Factory.getDeployTransaction())
      const contract = await Factory.deploy({gasLimit: deployGasEstimate})

      const fnGasEstimate = await ethers.provider.estimateGas(await contract.populateTransaction.foo())
      const tx = await contract.functions.foo({gasLimit: fnGasEstimate})
    })

    it('Suicide To', async () => {
      const [ signer ] = await ethers.getSigners();

      const randomAddr = (new Wallet(formatBytes32String(Math.random().toString()))).address
      expect(await ethers.provider.getBalance(randomAddr)).to.eq(0)

      const Factory = await ethers.getContractFactory('SuicideTo')
      const contract = await Factory.deploy(randomAddr, {value: 1337})

      expect(await ethers.provider.getBalance(contract.address)).to.eq(0)
      expect(await ethers.provider.getBalance(randomAddr)).to.eq(1337)
    })

    it('Create2', async () => {
      const [ signer ] = await ethers.getSigners();
      
      const Factory = await ethers.getContractFactory('CreateTwo')
      const deployGasEstimate = await ethers.provider.estimateGas(Factory.getDeployTransaction())
      const contract = await Factory.deploy({gasLimit: deployGasEstimate})

      const salt = formatBytes32String("salt")
      const fnGasEstimate = await ethers.provider.estimateGas(await contract.populateTransaction.create2(salt))
      const tx = await contract.functions.create2(salt, {gasLimit: fnGasEstimate})
    })

    it('Fail deploy with value refund', async () => {
      const [ signer ] = await ethers.getSigners();
      
      const deploydata = "0x01"
      const beforeBalance = await signer.getBalance()
      const tx = await signer.sendTransaction({data: deploydata, gasLimit:"0x10000000", value: 1})
      let receipt
      try{ 
        receipt = await tx.wait()
        assert(false)
      }catch(error: any){ 
        receipt = error.receipt
        expect(beforeBalance.sub(await signer.getBalance())).eq(receipt.gasUsed.mul(receipt.effectiveGasPrice))
      }
    })

    it('StorageSpam', async () => {
      const [ signer ] = await ethers.getSigners();
      
      const Factory = await ethers.getContractFactory('StorageSpam')
      const deployGasEstimate = await ethers.provider.estimateGas(Factory.getDeployTransaction())
      const contract = await Factory.deploy({gasLimit: deployGasEstimate})

      const x = 888
      const fnGasEstimate = await ethers.provider.estimateGas(await contract.populateTransaction.spam(x))
      const tx = await contract.functions.spam(x)
    })

    it('ECRecover', async () => {
      const [ signer ] = await ethers.getSigners();
      const randomSigner = (new Wallet(formatBytes32String((Math.random()*10000).toString())))

      const Factory = await ethers.getContractFactory('ECRecover')
      const deployGasEstimate = await ethers.provider.estimateGas(Factory.getDeployTransaction())
      const contract = await Factory.deploy({gasLimit: deployGasEstimate})

      const test = 0x1234567890
      const testBytes = ethers.utils.arrayify(test)
      const messageHash = ethers.utils.hashMessage(testBytes)
      const signature = await randomSigner.signMessage(testBytes)
      const split = ethers.utils.splitSignature(signature)

      const recoveredAddress = ethers.utils.verifyMessage(testBytes, signature)
      expect(randomSigner.address).to.equal(recoveredAddress)
      expect(await contract.callStatic.recover(messageHash, split.v, split.r, split.s)).to.equal(randomSigner.address)
    })
})