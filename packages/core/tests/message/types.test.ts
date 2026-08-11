import { describe, it, expect } from 'vitest'
import {
  ChildToParentMessageStatus,
  InboxMessageKind,
  ParentToChildMessageStatus,
  EthDepositMessageStatus,
} from '../../src/message/types'

describe('Message status enums', () => {
  describe('ChildToParentMessageStatus', () => {
    it('has UNCONFIRMED = 0', () => {
      expect(ChildToParentMessageStatus.UNCONFIRMED).toBe(0)
    })

    it('has CONFIRMED = 1', () => {
      expect(ChildToParentMessageStatus.CONFIRMED).toBe(1)
    })

    it('has EXECUTED = 2', () => {
      expect(ChildToParentMessageStatus.EXECUTED).toBe(2)
    })
  })

  describe('ParentToChildMessageStatus', () => {
    it('has NOT_YET_CREATED = 1', () => {
      expect(ParentToChildMessageStatus.NOT_YET_CREATED).toBe(1)
    })

    it('has CREATION_FAILED = 2', () => {
      expect(ParentToChildMessageStatus.CREATION_FAILED).toBe(2)
    })

    it('has FUNDS_DEPOSITED_ON_CHILD = 3', () => {
      expect(ParentToChildMessageStatus.FUNDS_DEPOSITED_ON_CHILD).toBe(3)
    })

    it('has REDEEMED = 4', () => {
      expect(ParentToChildMessageStatus.REDEEMED).toBe(4)
    })

    it('has EXPIRED = 5', () => {
      expect(ParentToChildMessageStatus.EXPIRED).toBe(5)
    })
  })

  describe('EthDepositMessageStatus', () => {
    it('has PENDING = 1', () => {
      expect(EthDepositMessageStatus.PENDING).toBe(1)
    })

    it('has DEPOSITED = 2', () => {
      expect(EthDepositMessageStatus.DEPOSITED).toBe(2)
    })
  })

  describe('InboxMessageKind', () => {
    it('has L1MessageType_submitRetryableTx = 9', () => {
      expect(InboxMessageKind.L1MessageType_submitRetryableTx).toBe(9)
    })

    it('has L1MessageType_ethDeposit = 12', () => {
      expect(InboxMessageKind.L1MessageType_ethDeposit).toBe(12)
    })

    it('has L2MessageType_signedTx = 4', () => {
      expect(InboxMessageKind.L2MessageType_signedTx).toBe(4)
    })
  })
})
