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
import chai from "chai";
import { expect } from 'chai'
import { Wallet } from '@ethersproject/wallet'
import { ethers } from 'hardhat'
import { formatBytes32String } from 'ethers/lib/utils'
import { solidity } from "ethereum-waffle";
chai.use(solidity);

describe('Ether', async () => {
  
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

})