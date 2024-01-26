import { expect } from 'chai'
import { StaticJsonRpcProvider } from '@ethersproject/providers'
import { WalletClient, createWalletClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import {
  ViemSigner,
  createViemSigner,
  isWalletClient,
} from '../../src/lib/utils/universal/signerTransforms'

describe('ViemSigner', () => {
  describe('ViemSigner class', () => {
    let walletClient: WalletClient // Assume this is a valid WalletClient instance
    let viemSigner: ViemSigner

    beforeEach(() => {
      // Initialize with a real or mock WalletClient
      walletClient = createWalletClient({
        chain: mainnet,
        transport: http(),
      })
      viemSigner = new ViemSigner(walletClient)
    })

    it('should create an instance of ViemSigner', () => {
      expect(viemSigner).to.be.instanceOf(ViemSigner)
    })

    it('should have a provider of type StaticJsonRpcProvider', () => {
      expect(viemSigner.provider).to.be.instanceOf(StaticJsonRpcProvider)
    })
  })

  describe('createViemSigner function', () => {
    it('should create an instance of ViemSigner with a valid WalletClient', () => {
      const walletClient = createWalletClient({
        chain: mainnet,
        transport: http(),
      })
      const signer = createViemSigner(walletClient)
      expect(signer).to.be.instanceOf(ViemSigner)
    })

    it('should throw an error with an invalid WalletClient', () => {
      const invalidClient = {} // an invalid WalletClient
      //@ts-expect-error - intentionally passing an invalid WalletClient
      expect(() => createViemSigner(invalidClient)).to.throw(
        Error,
        'Invalid wallet client'
      )
    })
  })

  describe('isWalletClient function', () => {
    it('should return true for a valid WalletClient object', () => {
      const walletClient = createWalletClient({
        chain: mainnet,
        transport: http(),
      })
      expect(isWalletClient(walletClient)).to.be.true
    })

    it('should return false for an invalid object', () => {
      const invalidClient = {}
      expect(isWalletClient(invalidClient)).to.be.false
    })

    it('should return false for null and undefined', () => {
      expect(isWalletClient(null)).to.be.false
      expect(isWalletClient(undefined)).to.be.false
    })
  })
})
