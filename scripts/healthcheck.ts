'use strict'
import '@nomiclabs/hardhat-ethers'
import chai, { assert } from "chai";
import { expect } from 'chai'
import { Wallet } from '@ethersproject/wallet'
import { ethers } from 'hardhat'
import { formatBytes32String } from 'ethers/lib/utils'
import { solidity } from "ethereum-waffle";
chai.use(solidity);

;(async () => {
    const [ signer ] = await ethers.getSigners()
    const numAcct = 1
    const numTx = 1000
    const signers = []
    for (let i = 0; i < numAcct; i++) {
      const randomSigner = Wallet.createRandom().connect(signer.provider!)
      console.log(randomSigner.privateKey)
      await signer.sendTransaction({to: randomSigner.address, value: ethers.utils.parseEther("0.1")})
      signers.push(randomSigner)
    }
    for (let j = 0; j < numTx; j++) {
      const tasks = signers.map(s=>s.sendTransaction({to: s.address, data: ethers.utils.formatBytes32String("healthcheck")}))
      await Promise.all(tasks)
      process.stdout.write(".")
      await new Promise(f => setTimeout(f, 10000));
    }
    console.log('')
  })()
