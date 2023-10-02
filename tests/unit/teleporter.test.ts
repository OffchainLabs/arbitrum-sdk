// import * as dotenv from "dotenv"
// dotenv.config()
// import { expect } from "chai"
// import {TeleporterUtils} from "../../src/lib/assetBridger/teleporter"
// import { getL2Network, l1Networks, l2Networks } from "../../src/lib/dataEntities/networks"
// import { ethers, providers } from "ethers"
// import { anything, deepEqual, instance, mock, when } from "ts-mockito"
// import { L1GatewayRouter__factory } from "../../src/lib/abi/factories/L1GatewayRouter__factory"
// import { AbiCoder } from "ethers/lib/utils"
// import { DISABLED_GATEWAY } from "../../src/lib/dataEntities/constants"

// type Provider = providers.JsonRpcProvider

// const l3ChainId = 23011913
// const l2ChainId = 421614
// const l1ChainId = 11155111
// const l1WETH = l2Networks[l2ChainId].tokenBridge.l1Weth
// const l2WETH = l2Networks[l2ChainId].tokenBridge.l2Weth
// const l3WETH = l2Networks[l3ChainId].tokenBridge.l2Weth

// function getEnv(k: string) {
//   const v = process.env[k]
//   if (!v) {
//     throw new Error(`Missing env var ${k}`)
//   }
//   return v
// }

// function createProviderMock(chainId: number) {
//   const l2ProviderMock = mock(providers.JsonRpcProvider)
//   const latestBlock = 1
//   when(l2ProviderMock.getBlockNumber()).thenResolve(latestBlock)
//   when(l2ProviderMock.getNetwork()).thenResolve({
//     chainId: chainId
//   } as any)
//   when(l2ProviderMock._isProvider).thenReturn(true)
//   when(l2ProviderMock.getLogs(anything())).thenResolve([])

//   return l2ProviderMock
// }

// function mockFunctionCall(
//   mockProvider: Provider,
//   args: { data: string; to: string; response: string }
// ) {
//   when(
//     mockProvider.call(
//       deepEqual({
//         data: args.data,
//         to: args.to,
//       }),
//       anything()
//     )
//   ).thenResolve(args.response)

//   return mockProvider
// }

// function mockGetGateway(
//   mockProvider: Provider,
//   args: { router: string; token: string; gateway: string }
// ) {
//   return mockFunctionCall(mockProvider, {
//     data: L1GatewayRouter__factory.createInterface().encodeFunctionData("getGateway", [args.token]),
//     to: args.router,
//     response: new AbiCoder().encode(["address"], [args.gateway])
//   })
// }

// function mockCalculateL2TokenAddress(
//   mockProvider: Provider,
//   args: { router: string; l1Token: string; l2Token: string }
// ) {
//   return mockFunctionCall(mockProvider, {
//     data: L1GatewayRouter__factory.createInterface().encodeFunctionData("calculateL2TokenAddress", [args.l1Token]),
//     to: args.router,
//     response: new AbiCoder().encode(["address"], [args.l2Token])
//   })
// }

// function mockL1TokenToGateway(
//   mockProvider: Provider,
//   args: { router: string; l1Token: string; gateway: string }
// ) {
//   return mockFunctionCall(mockProvider, {
//     data: L1GatewayRouter__factory.createInterface().encodeFunctionData("l1TokenToGateway", [args.l1Token]),
//     to: args.router,
//     response: new AbiCoder().encode(["address"], [args.gateway])
//   })
// }

// describe('Teleporter', () => {
//   let teleporter: TeleporterUtils

//   const l1Network = l1Networks[l1ChainId]
//   const l2Network = l2Networks[l2ChainId]
//   const l3Network = l2Networks[l3ChainId]

//   let l1ProviderMock: Provider
//   let l2ProviderMock: Provider
//   let l3ProviderMock: Provider

//   let l1Provider: Provider
//   let l2Provider: Provider
//   let l3Provider: Provider

//   beforeEach(() => {
//     teleporter = new TeleporterUtils(l3Network)

//     l1ProviderMock = createProviderMock(l1Network.chainID)
//     l2ProviderMock = createProviderMock(l2Network.chainID)
//     l3ProviderMock = createProviderMock(l3Network.chainID)

//     // mock get gateway calls
//     l1ProviderMock = mockGetGateway(l1ProviderMock, {
//       router: l2Network.tokenBridge.l1GatewayRouter,
//       token: l1WETH,
//       gateway: l2Network.tokenBridge.l1WethGateway
//     })
//     l2ProviderMock = mockGetGateway(l2ProviderMock, {
//       router: l3Network.tokenBridge.l1GatewayRouter,
//       token: l2WETH,
//       gateway: l3Network.tokenBridge.l1WethGateway
//     })

//     // mock calculateL2TokenAddress calls
//     l1ProviderMock = mockCalculateL2TokenAddress(l1ProviderMock, {
//       router: l2Network.tokenBridge.l1GatewayRouter,
//       l1Token: l1WETH,
//       l2Token: l2WETH
//     })
//     l2ProviderMock = mockCalculateL2TokenAddress(l2ProviderMock, {
//       router: l3Network.tokenBridge.l1GatewayRouter,
//       l1Token: l2WETH,
//       l2Token: l3WETH
//     })

//     l1Provider = instance(l1ProviderMock)
//     l2Provider = instance(l2ProviderMock)
//     l3Provider = instance(l3ProviderMock)
//   })

//   it('should set L2 and L1 properly', () => {
//     expect(teleporter.l2Network.chainID).to.equal(l2ChainId)
//     expect(teleporter.l1Network.chainID).to.equal(l1ChainId)
//   })
  
//   it('should return correct L2 token address', async () => {
//     const l2TokenAddress = await teleporter.getL2ERC20Address(l1WETH, l1Provider)
//     expect(l2TokenAddress).to.equal(l2WETH)
//   })
    
//   it('should return correct L3 token address', async () => {
//     const l3TokenAddress = await teleporter.getL3ERC20Address(l1WETH, l1Provider, l2Provider)
//     expect(l3TokenAddress).to.equal(l3WETH)
//   })
      
//   it('should return correct L1 -> L2 gateway', async () => {
//     const l1l2Gateway = await teleporter.getL1L2GatewayAddress(l1WETH, l1Provider)
//     expect(l1l2Gateway).to.equal(l2Network.tokenBridge.l1WethGateway)
//   })

//   it('should return correct L2 -> L3 gateway', async () => {
//     const l2l3Gateway = await teleporter.getL2L3GatewayAddress(l1WETH, l1Provider, l2Provider)
//     expect(l2l3Gateway).to.equal(l3Network.tokenBridge.l1WethGateway)
//   })

//   it('should return wether a token is disabled', async () => {
//     // mock l1TokenToGateway calls
//     l1ProviderMock = mockL1TokenToGateway(l1ProviderMock, {
//       router: l2Network.tokenBridge.l1GatewayRouter,
//       l1Token: l1WETH,
//       gateway: DISABLED_GATEWAY
//     })
//     l1Provider = instance(l1ProviderMock)

//     l2ProviderMock = mockL1TokenToGateway(l2ProviderMock, {
//       router: l3Network.tokenBridge.l1GatewayRouter,
//       l1Token: l2WETH,
//       gateway: l3Network.tokenBridge.l1WethGateway
//     })
//     l2Provider = instance(l2ProviderMock)

//     expect(await teleporter.l1TokenIsDisabled(l1WETH, l1Provider)).to.equal(true)
//     expect(await teleporter.l2TokenIsDisabled(l2WETH, l2Provider)).to.equal(false)
//   })
// })