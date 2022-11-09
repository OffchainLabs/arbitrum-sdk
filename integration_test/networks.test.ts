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
'use strict'

import { expect } from 'chai'
import { getL1Network } from '../src'
import {
  addCustomNetwork,
  getL2Network,
  isL1Network,
  L1Network,
  l1Networks,
  L2Network,
  l2Networks,
} from '../src/lib/dataEntities/networks'
import { providers } from 'ethers'
import { instance, mock, when } from 'ts-mockito'
import { SEVEN_DAYS_IN_SECONDS } from '../src/lib/dataEntities/constants'

/**
 * This is a unit test rather than an integration test.
 * TODO -> We'll move it out of integration_test/ when we restructure the tests
 */
describe('Methods in networks.ts', () => {
  const createProviderMock = (chainId: number) => {
    const providerMock = mock(providers.JsonRpcProvider)
    when(providerMock.getNetwork()).thenResolve({
      chainId,
    } as any)
    when(providerMock._isProvider).thenReturn(true)
    const provider = instance(providerMock)

    return {
      provider,
      providerMock,
    }
  }

  context('getL1Network', () => {
    it('should return an L1 network if passed an L1 Chain ID in the Networks list', () => {
      const getL1NetworkResult1 = getL1Network(1)
      const getL1NetworkResult1338 = getL1Network(1338)
      const getL1NetworkResult4 = getL1Network(4)
      const getL1NetworkResult5 = getL1Network(5)

      expect(getL1NetworkResult1).to.deep.equal(l1Networks[1])
      expect(getL1NetworkResult1338).to.deep.equal(l1Networks[1338])
      expect(getL1NetworkResult4).to.deep.equal(l1Networks[4])
      expect(getL1NetworkResult5).to.deep.equal(l1Networks[5])
    })
    it('should return an L1 network if passed an L1 Provider with a network in the Networks list', async () => {
      const { provider: l1Provider1 } = createProviderMock(1)
      const { provider: l1Provider1338 } = createProviderMock(1338)
      const { provider: l1Provider4 } = createProviderMock(4)
      const { provider: l1Provider5 } = createProviderMock(5)

      const getL1NetworkResult1 = await getL1Network(l1Provider1)
      const getL1NetworkResult1338 = await getL1Network(l1Provider1338)
      const getL1NetworkResult4 = await getL1Network(l1Provider4)
      const getL1NetworkResult5 = await getL1Network(l1Provider5)

      expect(getL1NetworkResult1).to.deep.equal(l1Networks[1])
      expect(getL1NetworkResult1338).to.deep.equal(l1Networks[1338])
      expect(getL1NetworkResult4).to.deep.equal(l1Networks[4])
      expect(getL1NetworkResult5).to.deep.equal(l1Networks[5])
    })
    it('should throw an error if passed an L2 Chain ID', () => {
      expect(() => {
        getL1Network(42161)
      }).to.throw('Unrecognized network 42161.')
      expect(() => {
        getL1Network(421611)
      }).to.throw('Unrecognized network 421611.')
      expect(() => {
        getL1Network(421613)
      }).to.throw('Unrecognized network 421613.')
      expect(() => {
        getL1Network(42170)
      }).to.throw('Unrecognized network 42170.')
    })
    it('should throw an error if passed an L1 Chain ID not in the Networks list', () => {
      // Chain ID 137 is Polygon
      expect(() => {
        getL1Network(137)
      }).to.throw('Unrecognized network 137.')
    })
  })

  context('getL2Network', () => {
    it('should return an L2 network if passed an L2 Chain ID in the Networks list', () => {
      const getL2NetworkResult42161 = getL2Network(42161)
      const getL2NetworkResult421611 = getL2Network(421611)
      const getL2NetworkResult421613 = getL2Network(421613)
      const getL2NetworkResult42170 = getL2Network(42170)

      expect(getL2NetworkResult42161).to.deep.equal(l2Networks[42161])
      expect(getL2NetworkResult421611).to.deep.equal(l2Networks[421611])
      expect(getL2NetworkResult421613).to.deep.equal(l2Networks[421613])
      expect(getL2NetworkResult42170).to.deep.equal(l2Networks[42170])
    })
    it('should return an L2 network if passed an L2 Provider with a network in the Networks list', async () => {
      const { provider: l2Provider42161 } = createProviderMock(42161)
      const { provider: l2Provider421611 } = createProviderMock(421611)
      const { provider: l2Provider421613 } = createProviderMock(421613)
      const { provider: l2Provider42170 } = createProviderMock(42170)

      const getL2NetworkResult42161 = await getL2Network(l2Provider42161)
      const getL2NetworkResult421611 = await getL2Network(l2Provider421611)
      const getL2NetworkResult421613 = await getL2Network(l2Provider421613)
      const getL2NetworkResult42170 = await getL2Network(l2Provider42170)

      expect(getL2NetworkResult42161).to.deep.equal(l2Networks[42161])
      expect(getL2NetworkResult421611).to.deep.equal(l2Networks[421611])
      expect(getL2NetworkResult421613).to.deep.equal(l2Networks[421613])
      expect(getL2NetworkResult42170).to.deep.equal(l2Networks[42170])
    })
    it('should throw an error if passed an L1 Chain ID', () => {
      expect(() => {
        getL2Network(1)
      }).to.throw('Unrecognized network 1.')
      expect(() => {
        getL2Network(1338)
      }).to.throw('Unrecognized network 1338.')
      expect(() => {
        getL2Network(4)
      }).to.throw('Unrecognized network 4.')
      expect(() => {
        getL2Network(5)
      }).to.throw('Unrecognized network 5.')
    })
    it('should throw an error if passed an L2 Chain ID not in the Networks list', () => {
      // Chain ID 420 is Optimism Goerli
      expect(() => {
        getL2Network(420)
      }).to.throw('Unrecognized network 420.')
    })
  })

  context('addCustomNetwork', () => {
    it('should add the custom L1 and L2 networks to the l1Networks and l2Networks objects respectively', () => {
      const customL1Network: L1Network = {
        chainID: 2,
        name: 'Alphanet',
        explorerUrl: 'https://etherscan.io',
        partnerChainIDs: [42161, 42170],
        blockTime: 14,
        isCustom: true,
        isArbitrum: false,
      }
      const customL2Network: L2Network = {
        chainID: 42172,
        confirmPeriodBlocks: 45818,
        ethBridge: {
          bridge: '0xc1ebd02f738644983b6c4b2d440b8e77dde276bd',
          inbox: '0xc4448b71118c9071bcb9734a0eac55d18a153949',
          outbox: '0xD4B80C3D7240325D18E645B49e6535A3Bf95cc58',
          rollup: '0xfb209827c58283535b744575e11953dcc4bead88',
          sequencerInbox: '0x211e1c4c7f1bf5351ac850ed10fd68cffcf6c21b',
        },
        explorerUrl: 'https://nova.arbiscan.io',
        isArbitrum: true,
        isCustom: true,
        name: 'Arbitrum Alpha',
        partnerChainID: 1,
        retryableLifetimeSeconds: SEVEN_DAYS_IN_SECONDS,
        tokenBridge: {
          l1CustomGateway: '0x23122da8C581AA7E0d07A36Ff1f16F799650232f',
          l1ERC20Gateway: '0xB2535b988dcE19f9D71dfB22dB6da744aCac21bf',
          l1GatewayRouter: '0xC840838Bc438d73C16c2f8b22D2Ce3669963cD48',
          l1MultiCall: '0x8896d23afea159a5e9b72c9eb3dc4e2684a38ea3',
          l1ProxyAdmin: '0xa8f7DdEd54a726eB873E98bFF2C95ABF2d03e560',
          l1Weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
          l1WethGateway: '0xE4E2121b479017955Be0b175305B35f312330BaE',
          l2CustomGateway: '0xbf544970E6BD77b21C6492C281AB60d0770451F4',
          l2ERC20Gateway: '0xcF9bAb7e53DDe48A6DC4f286CB14e05298799257',
          l2GatewayRouter: '0x21903d3F8176b1a0c17E953Cd896610Be9fFDFa8',
          l2Multicall: '0x5e1eE626420A354BbC9a95FeA1BAd4492e3bcB86',
          l2ProxyAdmin: '0xada790b026097BfB36a5ed696859b97a96CEd92C',
          l2Weth: '0x722E8BdD2ce80A4422E880164f2079488e115365',
          l2WethGateway: '0x7626841cB6113412F9c88D3ADC720C9FAC88D9eD',
        },
        nitroGenesisBlock: 0,
        depositTimeout: 888000,
      }
      addCustomNetwork({
        customL1Network,
        customL2Network,
      })
      expect(getL1Network(2)).to.deep.equal(customL1Network)
      expect(getL2Network(42172)).to.deep.equal(customL2Network)
    })
    it('should throw an error if passed an L1 network that has already been included', () => {
      expect(() => {
        addCustomNetwork({
          customL1Network: {
            chainID: 2,
            name: 'Alphanet',
            explorerUrl: 'https://etherscan.io',
            partnerChainIDs: [42161, 42170],
            blockTime: 14,
            isCustom: true,
            isArbitrum: false,
          },
          customL2Network: {
            chainID: 42173,
            confirmPeriodBlocks: 45818,
            ethBridge: {
              bridge: '0xc1ebd02f738644983b6c4b2d440b8e77dde276bd',
              inbox: '0xc4448b71118c9071bcb9734a0eac55d18a153949',
              outbox: '0xD4B80C3D7240325D18E645B49e6535A3Bf95cc58',
              rollup: '0xfb209827c58283535b744575e11953dcc4bead88',
              sequencerInbox: '0x211e1c4c7f1bf5351ac850ed10fd68cffcf6c21b',
            },
            explorerUrl: 'https://nova.arbiscan.io',
            isArbitrum: true,
            isCustom: false,
            name: 'Arbitrum Nova',
            partnerChainID: 2,
            retryableLifetimeSeconds: SEVEN_DAYS_IN_SECONDS,
            tokenBridge: {
              l1CustomGateway: '0x23122da8C581AA7E0d07A36Ff1f16F799650232f',
              l1ERC20Gateway: '0xB2535b988dcE19f9D71dfB22dB6da744aCac21bf',
              l1GatewayRouter: '0xC840838Bc438d73C16c2f8b22D2Ce3669963cD48',
              l1MultiCall: '0x8896d23afea159a5e9b72c9eb3dc4e2684a38ea3',
              l1ProxyAdmin: '0xa8f7DdEd54a726eB873E98bFF2C95ABF2d03e560',
              l1Weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
              l1WethGateway: '0xE4E2121b479017955Be0b175305B35f312330BaE',
              l2CustomGateway: '0xbf544970E6BD77b21C6492C281AB60d0770451F4',
              l2ERC20Gateway: '0xcF9bAb7e53DDe48A6DC4f286CB14e05298799257',
              l2GatewayRouter: '0x21903d3F8176b1a0c17E953Cd896610Be9fFDFa8',
              l2Multicall: '0x5e1eE626420A354BbC9a95FeA1BAd4492e3bcB86',
              l2ProxyAdmin: '0xada790b026097BfB36a5ed696859b97a96CEd92C',
              l2Weth: '0x722E8BdD2ce80A4422E880164f2079488e115365',
              l2WethGateway: '0x7626841cB6113412F9c88D3ADC720C9FAC88D9eD',
            },
            nitroGenesisBlock: 0,
            depositTimeout: 888000,
          },
        })
      }).to.throw('Network 2 already included')
    })
    it('should throw an error if passed an L1 network with isCustom flag set to false', () => {
      expect(() => {
        addCustomNetwork({
          customL1Network: {
            chainID: 3,
            name: 'Alphanet',
            explorerUrl: 'https://etherscan.io',
            partnerChainIDs: [42161, 42170],
            blockTime: 14,
            isCustom: false,
            isArbitrum: false,
          },
          customL2Network: {
            chainID: 42173,
            confirmPeriodBlocks: 45818,
            ethBridge: {
              bridge: '0xc1ebd02f738644983b6c4b2d440b8e77dde276bd',
              inbox: '0xc4448b71118c9071bcb9734a0eac55d18a153949',
              outbox: '0xD4B80C3D7240325D18E645B49e6535A3Bf95cc58',
              rollup: '0xfb209827c58283535b744575e11953dcc4bead88',
              sequencerInbox: '0x211e1c4c7f1bf5351ac850ed10fd68cffcf6c21b',
            },
            explorerUrl: 'https://nova.arbiscan.io',
            isArbitrum: true,
            isCustom: false,
            name: 'Arbitrum Alpha',
            partnerChainID: 1,
            retryableLifetimeSeconds: SEVEN_DAYS_IN_SECONDS,
            tokenBridge: {
              l1CustomGateway: '0x23122da8C581AA7E0d07A36Ff1f16F799650232f',
              l1ERC20Gateway: '0xB2535b988dcE19f9D71dfB22dB6da744aCac21bf',
              l1GatewayRouter: '0xC840838Bc438d73C16c2f8b22D2Ce3669963cD48',
              l1MultiCall: '0x8896d23afea159a5e9b72c9eb3dc4e2684a38ea3',
              l1ProxyAdmin: '0xa8f7DdEd54a726eB873E98bFF2C95ABF2d03e560',
              l1Weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
              l1WethGateway: '0xE4E2121b479017955Be0b175305B35f312330BaE',
              l2CustomGateway: '0xbf544970E6BD77b21C6492C281AB60d0770451F4',
              l2ERC20Gateway: '0xcF9bAb7e53DDe48A6DC4f286CB14e05298799257',
              l2GatewayRouter: '0x21903d3F8176b1a0c17E953Cd896610Be9fFDFa8',
              l2Multicall: '0x5e1eE626420A354BbC9a95FeA1BAd4492e3bcB86',
              l2ProxyAdmin: '0xada790b026097BfB36a5ed696859b97a96CEd92C',
              l2Weth: '0x722E8BdD2ce80A4422E880164f2079488e115365',
              l2WethGateway: '0x7626841cB6113412F9c88D3ADC720C9FAC88D9eD',
            },
            nitroGenesisBlock: 0,
            depositTimeout: 888000,
          },
        })
      }).to.throw('Custom network 3 must have isCustom flag set to true')
    })
    it('should throw an error if passed an L2 network that has already been included', () => {
      expect(() => {
        addCustomNetwork({
          customL2Network: {
            chainID: 42170,
            confirmPeriodBlocks: 45818,
            ethBridge: {
              bridge: '0xc1ebd02f738644983b6c4b2d440b8e77dde276bd',
              inbox: '0xc4448b71118c9071bcb9734a0eac55d18a153949',
              outbox: '0xD4B80C3D7240325D18E645B49e6535A3Bf95cc58',
              rollup: '0xfb209827c58283535b744575e11953dcc4bead88',
              sequencerInbox: '0x211e1c4c7f1bf5351ac850ed10fd68cffcf6c21b',
            },
            explorerUrl: 'https://nova.arbiscan.io',
            isArbitrum: true,
            isCustom: false,
            name: 'Arbitrum Nova',
            partnerChainID: 1,
            retryableLifetimeSeconds: SEVEN_DAYS_IN_SECONDS,
            tokenBridge: {
              l1CustomGateway: '0x23122da8C581AA7E0d07A36Ff1f16F799650232f',
              l1ERC20Gateway: '0xB2535b988dcE19f9D71dfB22dB6da744aCac21bf',
              l1GatewayRouter: '0xC840838Bc438d73C16c2f8b22D2Ce3669963cD48',
              l1MultiCall: '0x8896d23afea159a5e9b72c9eb3dc4e2684a38ea3',
              l1ProxyAdmin: '0xa8f7DdEd54a726eB873E98bFF2C95ABF2d03e560',
              l1Weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
              l1WethGateway: '0xE4E2121b479017955Be0b175305B35f312330BaE',
              l2CustomGateway: '0xbf544970E6BD77b21C6492C281AB60d0770451F4',
              l2ERC20Gateway: '0xcF9bAb7e53DDe48A6DC4f286CB14e05298799257',
              l2GatewayRouter: '0x21903d3F8176b1a0c17E953Cd896610Be9fFDFa8',
              l2Multicall: '0x5e1eE626420A354BbC9a95FeA1BAd4492e3bcB86',
              l2ProxyAdmin: '0xada790b026097BfB36a5ed696859b97a96CEd92C',
              l2Weth: '0x722E8BdD2ce80A4422E880164f2079488e115365',
              l2WethGateway: '0x7626841cB6113412F9c88D3ADC720C9FAC88D9eD',
            },
            nitroGenesisBlock: 0,
            depositTimeout: 888000,
          },
        })
      }).to.throw('Network 42170 already included')
    })
    it('should throw an error if passed an L2 network with isCustom flag set to false', () => {
      expect(() => {
        addCustomNetwork({
          customL2Network: {
            chainID: 42173,
            confirmPeriodBlocks: 45818,
            ethBridge: {
              bridge: '0xc1ebd02f738644983b6c4b2d440b8e77dde276bd',
              inbox: '0xc4448b71118c9071bcb9734a0eac55d18a153949',
              outbox: '0xD4B80C3D7240325D18E645B49e6535A3Bf95cc58',
              rollup: '0xfb209827c58283535b744575e11953dcc4bead88',
              sequencerInbox: '0x211e1c4c7f1bf5351ac850ed10fd68cffcf6c21b',
            },
            explorerUrl: 'https://nova.arbiscan.io',
            isArbitrum: true,
            isCustom: false,
            name: 'Arbitrum Alpha',
            partnerChainID: 1,
            retryableLifetimeSeconds: SEVEN_DAYS_IN_SECONDS,
            tokenBridge: {
              l1CustomGateway: '0x23122da8C581AA7E0d07A36Ff1f16F799650232f',
              l1ERC20Gateway: '0xB2535b988dcE19f9D71dfB22dB6da744aCac21bf',
              l1GatewayRouter: '0xC840838Bc438d73C16c2f8b22D2Ce3669963cD48',
              l1MultiCall: '0x8896d23afea159a5e9b72c9eb3dc4e2684a38ea3',
              l1ProxyAdmin: '0xa8f7DdEd54a726eB873E98bFF2C95ABF2d03e560',
              l1Weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
              l1WethGateway: '0xE4E2121b479017955Be0b175305B35f312330BaE',
              l2CustomGateway: '0xbf544970E6BD77b21C6492C281AB60d0770451F4',
              l2ERC20Gateway: '0xcF9bAb7e53DDe48A6DC4f286CB14e05298799257',
              l2GatewayRouter: '0x21903d3F8176b1a0c17E953Cd896610Be9fFDFa8',
              l2Multicall: '0x5e1eE626420A354BbC9a95FeA1BAd4492e3bcB86',
              l2ProxyAdmin: '0xada790b026097BfB36a5ed696859b97a96CEd92C',
              l2Weth: '0x722E8BdD2ce80A4422E880164f2079488e115365',
              l2WethGateway: '0x7626841cB6113412F9c88D3ADC720C9FAC88D9eD',
            },
            nitroGenesisBlock: 0,
            depositTimeout: 888000,
          },
        })
      }).to.throw('Custom network 42173 must have isCustom flag set to true')
    })
    it('should throw an error if passed an L2 network with an unrecognized partner network', () => {
      expect(() => {
        addCustomNetwork({
          customL2Network: {
            chainID: 42173,
            confirmPeriodBlocks: 45818,
            ethBridge: {
              bridge: '0xc1ebd02f738644983b6c4b2d440b8e77dde276bd',
              inbox: '0xc4448b71118c9071bcb9734a0eac55d18a153949',
              outbox: '0xD4B80C3D7240325D18E645B49e6535A3Bf95cc58',
              rollup: '0xfb209827c58283535b744575e11953dcc4bead88',
              sequencerInbox: '0x211e1c4c7f1bf5351ac850ed10fd68cffcf6c21b',
            },
            explorerUrl: 'https://nova.arbiscan.io',
            isArbitrum: true,
            isCustom: true,
            name: 'Arbitrum Alpha',
            partnerChainID: 15,
            retryableLifetimeSeconds: SEVEN_DAYS_IN_SECONDS,
            tokenBridge: {
              l1CustomGateway: '0x23122da8C581AA7E0d07A36Ff1f16F799650232f',
              l1ERC20Gateway: '0xB2535b988dcE19f9D71dfB22dB6da744aCac21bf',
              l1GatewayRouter: '0xC840838Bc438d73C16c2f8b22D2Ce3669963cD48',
              l1MultiCall: '0x8896d23afea159a5e9b72c9eb3dc4e2684a38ea3',
              l1ProxyAdmin: '0xa8f7DdEd54a726eB873E98bFF2C95ABF2d03e560',
              l1Weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
              l1WethGateway: '0xE4E2121b479017955Be0b175305B35f312330BaE',
              l2CustomGateway: '0xbf544970E6BD77b21C6492C281AB60d0770451F4',
              l2ERC20Gateway: '0xcF9bAb7e53DDe48A6DC4f286CB14e05298799257',
              l2GatewayRouter: '0x21903d3F8176b1a0c17E953Cd896610Be9fFDFa8',
              l2Multicall: '0x5e1eE626420A354BbC9a95FeA1BAd4492e3bcB86',
              l2ProxyAdmin: '0xada790b026097BfB36a5ed696859b97a96CEd92C',
              l2Weth: '0x722E8BdD2ce80A4422E880164f2079488e115365',
              l2WethGateway: '0x7626841cB6113412F9c88D3ADC720C9FAC88D9eD',
            },
            nitroGenesisBlock: 0,
            depositTimeout: 888000,
          },
        })
      }).to.throw("Network 42173's partner network, 15, not recognized")
    })
  })

  context('isL1Network', () => {
    it('should return true if an L1 network is passed in', () => {
      const isL1NetworkResult = isL1Network({
        blockTime: 15,
        chainID: 5,
        explorerUrl: 'https://goerli.etherscan.io',
        isCustom: false,
        name: 'Goerli',
        partnerChainIDs: [421613],
        isArbitrum: false,
      })

      expect(isL1NetworkResult).to.be.true
    })
    it('should return false if an L2 network is passed in', () => {
      const isL1NetworkResult = isL1Network({
        chainID: 42170,
        confirmPeriodBlocks: 45818,
        ethBridge: {
          bridge: '0xc1ebd02f738644983b6c4b2d440b8e77dde276bd',
          inbox: '0xc4448b71118c9071bcb9734a0eac55d18a153949',
          outbox: '0xD4B80C3D7240325D18E645B49e6535A3Bf95cc58',
          rollup: '0xfb209827c58283535b744575e11953dcc4bead88',
          sequencerInbox: '0x211e1c4c7f1bf5351ac850ed10fd68cffcf6c21b',
        },
        explorerUrl: 'https://nova.arbiscan.io',
        isArbitrum: true,
        isCustom: false,
        name: 'Arbitrum Nova',
        partnerChainID: 1,
        retryableLifetimeSeconds: SEVEN_DAYS_IN_SECONDS,
        tokenBridge: {
          l1CustomGateway: '0x23122da8C581AA7E0d07A36Ff1f16F799650232f',
          l1ERC20Gateway: '0xB2535b988dcE19f9D71dfB22dB6da744aCac21bf',
          l1GatewayRouter: '0xC840838Bc438d73C16c2f8b22D2Ce3669963cD48',
          l1MultiCall: '0x8896d23afea159a5e9b72c9eb3dc4e2684a38ea3',
          l1ProxyAdmin: '0xa8f7DdEd54a726eB873E98bFF2C95ABF2d03e560',
          l1Weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
          l1WethGateway: '0xE4E2121b479017955Be0b175305B35f312330BaE',
          l2CustomGateway: '0xbf544970E6BD77b21C6492C281AB60d0770451F4',
          l2ERC20Gateway: '0xcF9bAb7e53DDe48A6DC4f286CB14e05298799257',
          l2GatewayRouter: '0x21903d3F8176b1a0c17E953Cd896610Be9fFDFa8',
          l2Multicall: '0x5e1eE626420A354BbC9a95FeA1BAd4492e3bcB86',
          l2ProxyAdmin: '0xada790b026097BfB36a5ed696859b97a96CEd92C',
          l2Weth: '0x722E8BdD2ce80A4422E880164f2079488e115365',
          l2WethGateway: '0x7626841cB6113412F9c88D3ADC720C9FAC88D9eD',
        },
        nitroGenesisBlock: 0,
        depositTimeout: 888000,
      })

      expect(isL1NetworkResult).to.be.false
    })
  })
})
