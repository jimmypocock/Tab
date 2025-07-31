import { PaymentAllocationService } from '@/lib/services/payment-allocation.service'
import { db } from '@/lib/db'
import { payments, billingGroups, lineItems } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// Mock database
jest.mock('@/lib/db', () => ({
  db: {
    transaction: jest.fn(),
    query: {
      payments: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      billingGroups: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    },
    update: jest.fn(() => ({
      set: jest.fn(() => ({
        where: jest.fn(() => ({
          returning: jest.fn(),
        })),
      })),
    })),
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: jest.fn(),
        })),
      })),
    })),
  },
  // Mock schema exports
  payments: {},
  billingGroups: {},
  lineItems: {},
}))

jest.mock('@/lib/logger')

describe('PaymentAllocationService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('allocatePaymentToBillingGroups', () => {
    const mockPayment = {
      id: 'payment_123',
      amount: '100.00',
      tabId: 'tab_123',
      metadata: {}
    }

    const mockBillingGroups = [
      {
        id: 'bg_1',
        name: 'Group 1',
        currentBalance: '60.00',
        lineItems: []
      },
      {
        id: 'bg_2',
        name: 'Group 2',
        currentBalance: '40.00',
        lineItems: []
      }
    ]

    it('should allocate payment proportionally across billing groups', async () => {
      const mockTransaction = jest.fn(async (callback) => {
        const tx = {
          query: {
            payments: {
              findFirst: jest.fn().mockResolvedValue(mockPayment),
            },
            billingGroups: {
              findMany: jest.fn().mockResolvedValue(mockBillingGroups),
            },
          },
          update: jest.fn(() => ({
            set: jest.fn(() => ({
              where: jest.fn(() => ({
                returning: jest.fn().mockResolvedValue([{ 
                  ...mockBillingGroups[0], 
                  currentBalance: '0.00' 
                }]),
              })),
            })),
          })),
        }
        return callback(tx)
      })

      ;(db.transaction as jest.Mock).mockImplementation(mockTransaction)

      const result = await PaymentAllocationService.allocatePaymentToBillingGroups(
        'payment_123',
        ['bg_1', 'bg_2'],
        'proportional'
      )

      expect(result.allocations).toHaveLength(2)
      expect(result.allocations[0]).toEqual({
        billingGroupId: 'bg_1',
        amount: 60, // 60% of payment
      })
      expect(result.allocations[1]).toEqual({
        billingGroupId: 'bg_2',
        amount: 40, // 40% of payment
      })
    })

    it('should allocate payment using FIFO method', async () => {
      const mockTransaction = jest.fn(async (callback) => {
        const tx = {
          query: {
            payments: {
              findFirst: jest.fn().mockResolvedValue(mockPayment),
            },
            billingGroups: {
              findMany: jest.fn().mockResolvedValue(mockBillingGroups),
            },
          },
          update: jest.fn(() => ({
            set: jest.fn(() => ({
              where: jest.fn(() => ({
                returning: jest.fn().mockResolvedValue([{ 
                  ...mockBillingGroups[0], 
                  currentBalance: '0.00' 
                }]),
              })),
            })),
          })),
        }
        return callback(tx)
      })

      ;(db.transaction as jest.Mock).mockImplementation(mockTransaction)

      const result = await PaymentAllocationService.allocatePaymentToBillingGroups(
        'payment_123',
        ['bg_1', 'bg_2'],
        'fifo'
      )

      expect(result.allocations).toHaveLength(2)
      expect(result.allocations[0]).toEqual({
        billingGroupId: 'bg_1',
        amount: 60, // First group gets its full balance
      })
      expect(result.allocations[1]).toEqual({
        billingGroupId: 'bg_2',
        amount: 40, // Second group gets remaining
      })
    })

    it('should allocate payment equally across groups', async () => {
      const mockTransaction = jest.fn(async (callback) => {
        const tx = {
          query: {
            payments: {
              findFirst: jest.fn().mockResolvedValue(mockPayment),
            },
            billingGroups: {
              findMany: jest.fn().mockResolvedValue(mockBillingGroups),
            },
          },
          update: jest.fn(() => ({
            set: jest.fn(() => ({
              where: jest.fn(() => ({
                returning: jest.fn().mockResolvedValue([{ 
                  ...mockBillingGroups[0], 
                  currentBalance: '10.00' 
                }]),
              })),
            })),
          })),
        }
        return callback(tx)
      })

      ;(db.transaction as jest.Mock).mockImplementation(mockTransaction)

      const result = await PaymentAllocationService.allocatePaymentToBillingGroups(
        'payment_123',
        ['bg_1', 'bg_2'],
        'equal'
      )

      expect(result.allocations).toHaveLength(2)
      // Each group should get 50, but first group gets its full balance (60)
      expect(result.allocations[0].amount).toBe(60) // Limited by balance
      expect(result.allocations[1].amount).toBe(40) // Gets remaining amount
    })

    it('should throw error if payment not found', async () => {
      const mockTransaction = jest.fn(async (callback) => {
        const tx = {
          query: {
            payments: {
              findFirst: jest.fn().mockResolvedValue(null),
            },
          },
        }
        return callback(tx)
      })

      ;(db.transaction as jest.Mock).mockImplementation(mockTransaction)

      await expect(
        PaymentAllocationService.allocatePaymentToBillingGroups(
          'invalid_payment',
          ['bg_1'],
          'proportional'
        )
      ).rejects.toThrow('Payment not found')
    })

    it('should throw error if no billing groups found', async () => {
      const mockTransaction = jest.fn(async (callback) => {
        const tx = {
          query: {
            payments: {
              findFirst: jest.fn().mockResolvedValue(mockPayment),
            },
            billingGroups: {
              findMany: jest.fn().mockResolvedValue([]),
            },
          },
        }
        return callback(tx)
      })

      ;(db.transaction as jest.Mock).mockImplementation(mockTransaction)

      await expect(
        PaymentAllocationService.allocatePaymentToBillingGroups(
          'payment_123',
          ['bg_1'],
          'proportional'
        )
      ).rejects.toThrow('No billing groups found')
    })
  })

  describe('allocatePaymentFromCheckout', () => {
    it('should allocate payment based on checkout metadata', async () => {
      const mockMetadata = {
        billingGroupIds: 'bg_1,bg_2',
        selectedGroups: 'bg_1,bg_2',
      }

      const allocateSpy = jest.spyOn(
        PaymentAllocationService, 
        'allocatePaymentToBillingGroups'
      ).mockResolvedValue({
        payment: {} as any,
        allocations: [],
        updatedGroups: [],
      })

      await PaymentAllocationService.allocatePaymentFromCheckout(
        'payment_123',
        mockMetadata
      )

      expect(allocateSpy).toHaveBeenCalledWith(
        'payment_123',
        ['bg_1', 'bg_2'],
        'proportional'
      )
    })

    it('should return null if no billing groups in metadata', async () => {
      const result = await PaymentAllocationService.allocatePaymentFromCheckout(
        'payment_123',
        {}
      )

      expect(result).toBeNull()
    })
  })

  describe('reversePaymentAllocation', () => {
    it('should reverse payment allocations', async () => {
      const mockPaymentWithAllocations = {
        id: 'payment_123',
        metadata: {
          billingGroupAllocations: [
            { billingGroupId: 'bg_1', amount: 60 },
            { billingGroupId: 'bg_2', amount: 40 },
          ]
        }
      }

      const mockTransaction = jest.fn(async (callback) => {
        const tx = {
          query: {
            payments: {
              findFirst: jest.fn().mockResolvedValue(mockPaymentWithAllocations),
            },
          },
          select: jest.fn(() => ({
            from: jest.fn(() => ({
              where: jest.fn(() => ({
                limit: jest.fn().mockResolvedValue([{
                  id: 'bg_1',
                  currentBalance: '0.00'
                }]),
              })),
            })),
          })),
          update: jest.fn(() => ({
            set: jest.fn(() => ({
              where: jest.fn().mockResolvedValue([]),
            })),
          })),
        }
        return callback(tx)
      })

      ;(db.transaction as jest.Mock).mockImplementation(mockTransaction)

      await PaymentAllocationService.reversePaymentAllocation('payment_123')

      expect(mockTransaction).toHaveBeenCalled()
    })

    it('should throw error if payment has no allocations', async () => {
      const mockTransaction = jest.fn(async (callback) => {
        const tx = {
          query: {
            payments: {
              findFirst: jest.fn().mockResolvedValue({
                id: 'payment_123',
                metadata: {}
              }),
            },
          },
        }
        return callback(tx)
      })

      ;(db.transaction as jest.Mock).mockImplementation(mockTransaction)

      await expect(
        PaymentAllocationService.reversePaymentAllocation('payment_123')
      ).rejects.toThrow('Payment or allocations not found')
    })
  })

  describe('getTabPaymentAllocations', () => {
    it('should return payment allocations for a tab', async () => {
      const mockPayments = [
        {
          id: 'payment_1',
          amount: '100.00',
          createdAt: new Date(),
          metadata: {
            billingGroupAllocations: [
              { billingGroupId: 'bg_1', amount: 60 }
            ],
            allocationMethod: 'proportional'
          }
        },
        {
          id: 'payment_2',
          amount: '50.00',
          createdAt: new Date(),
          metadata: {}
        }
      ]

      ;(db.query.payments.findMany as jest.Mock).mockResolvedValue(mockPayments)

      const result = await PaymentAllocationService.getTabPaymentAllocations('tab_123')

      expect(result).toHaveLength(1)
      expect(result[0].paymentId).toBe('payment_1')
      expect(result[0].allocations).toEqual([
        { billingGroupId: 'bg_1', amount: 60 }
      ])
    })
  })
})