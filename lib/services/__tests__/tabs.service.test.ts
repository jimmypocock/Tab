import { tabsService } from '../tabs.service'
import { db } from '@/lib/db/client'
import { tabs, lineItems } from '@/lib/db/schema'
import { CreateTabInput } from '@/lib/api/validation'
import { NotFoundError, ConflictError, DatabaseError } from '@/lib/errors'
import { TAX_RATE } from '@/lib/utils'

// Mock the database
jest.mock('@/lib/db/client', () => ({
  db: {
    transaction: jest.fn(),
    query: {
      tabs: {
        findFirst: jest.fn(),
      },
    },
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}))

// Mock logger to avoid console output in tests
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

describe('TabsService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createTab', () => {
    const mockTabInput: CreateTabInput = {
      customerEmail: 'test@example.com',
      customerName: 'Test Customer',
      currency: 'USD',
      lineItems: [
        {
          description: 'Product 1',
          quantity: 2,
          unitPrice: 50,
        },
        {
          description: 'Product 2',
          quantity: 1,
          unitPrice: 30,
        },
      ],
    }

    it('should create a tab with correct calculations', async () => {
      const mockTab = {
        id: 'tab_123',
        merchantId: 'merchant_123',
        customerEmail: 'test@example.com',
        customerName: 'Test Customer',
        currency: 'USD',
        subtotal: '130.00',
        taxAmount: '10.40',
        totalAmount: '140.40',
        paidAmount: '0.00',
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const mockLineItems = [
        {
          id: 'item_1',
          tabId: 'tab_123',
          description: 'Product 1',
          quantity: 2,
          unitPrice: '50.00',
          total: '100.00',
          createdAt: new Date(),
        },
        {
          id: 'item_2',
          tabId: 'tab_123',
          description: 'Product 2',
          quantity: 1,
          unitPrice: '30.00',
          total: '30.00',
          createdAt: new Date(),
        },
      ]

      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        const tx = {
          insert: jest.fn().mockReturnValue({
            values: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([mockTab]),
            }),
          }),
        }
        return callback(tx)
      })

      ;(db.transaction as jest.Mock).mockImplementation(mockTransaction)
      ;(db.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue(mockLineItems),
        }),
      })

      const result = await tabsService.createTab('merchant_123', mockTabInput)

      expect(result).toMatchObject({
        id: 'tab_123',
        customerEmail: 'test@example.com',
        subtotal: '130.00',
        taxAmount: '10.40',
        totalAmount: '140.40',
      })

      expect(db.transaction).toHaveBeenCalled()
    })

    it('should use custom tax rate when provided', async () => {
      const inputWithTax = {
        ...mockTabInput,
        taxRate: 0.15, // 15% tax
      }

      const mockTab = {
        id: 'tab_123',
        merchantId: 'merchant_123',
        customerEmail: 'test@example.com',
        customerName: 'Test Customer',
        currency: 'USD',
        subtotal: '130.00',
        taxAmount: '19.50', // 130 * 0.15
        totalAmount: '149.50', // 130 + 19.50
        paidAmount: '0.00',
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const mockLineItems = []

      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        const txInsert = jest.fn().mockReturnValue({
          values: jest.fn().mockImplementation((values) => {
            // Verify the tax calculation
            if (values.taxAmount) {
              expect(values.taxAmount).toBe('19.50')
              expect(values.totalAmount).toBe('149.50')
            }
            return {
              returning: jest.fn().mockResolvedValue(
                values.taxAmount ? [mockTab] : mockLineItems
              ),
            }
          }),
        })

        const tx = {
          insert: txInsert,
          query: {
            tabs: {
              findFirst: jest.fn().mockResolvedValue({
                ...mockTab,
                lineItems: mockLineItems,
              }),
            },
          },
        }
        return callback(tx)
      })

      ;(db.transaction as jest.Mock).mockImplementation(mockTransaction)

      const result = await tabsService.createTab('merchant_123', inputWithTax)
      
      expect(result.taxAmount).toBe('19.50')
      expect(result.totalAmount).toBe('149.50')
    })

    it('should handle database errors', async () => {
      ;(db.transaction as jest.Mock).mockRejectedValue(new Error('DB Error'))

      await expect(
        tabsService.createTab('merchant_123', mockTabInput)
      ).rejects.toThrow(DatabaseError)
    })
  })

  describe('getTab', () => {
    it('should fetch a tab with computed fields', async () => {
      const mockTab = {
        id: 'tab_123',
        merchantId: 'merchant_123',
        totalAmount: '100.00',
        paidAmount: '30.00',
        status: 'partial',
        lineItems: [],
        payments: [],
      }

      ;(db.query.tabs.findFirst as jest.Mock).mockResolvedValue(mockTab)

      const result = await tabsService.getTab('tab_123', 'merchant_123')

      expect(result).toMatchObject({
        ...mockTab,
        balance: 70,
        computedStatus: 'partial',
      })
    })

    it('should return null for non-existent tab', async () => {
      ;(db.query.tabs.findFirst as jest.Mock).mockResolvedValue(null)

      const result = await tabsService.getTab('tab_999', 'merchant_123')

      expect(result).toBeNull()
    })
  })

  describe('updateTab', () => {
    it('should update tab successfully', async () => {
      const existingTab = {
        id: 'tab_123',
        status: 'open',
        totalAmount: '100.00',
        paidAmount: '0.00',
      }

      const updatedTab = {
        ...existingTab,
        status: 'partial',
      }

      ;(db.query.tabs.findFirst as jest.Mock)
        .mockResolvedValueOnce(existingTab)
        .mockResolvedValueOnce(updatedTab)

      ;(db.update as jest.Mock).mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([updatedTab]),
          }),
        }),
      })

      const result = await tabsService.updateTab('tab_123', 'merchant_123', {
        status: 'partial',
      })

      expect(result.status).toBe('partial')
    })

    it('should throw NotFoundError for non-existent tab', async () => {
      ;(db.query.tabs.findFirst as jest.Mock).mockResolvedValue(null)

      await expect(
        tabsService.updateTab('tab_999', 'merchant_123', { status: 'paid' })
      ).rejects.toThrow(NotFoundError)
    })

    it('should validate status transitions', async () => {
      const paidTab = {
        id: 'tab_123',
        status: 'paid',
        totalAmount: '100.00',
        paidAmount: '100.00',
      }

      ;(db.query.tabs.findFirst as jest.Mock).mockResolvedValue(paidTab)

      await expect(
        tabsService.updateTab('tab_123', 'merchant_123', { status: 'open' })
      ).rejects.toThrow(ConflictError)
    })
  })

  describe('deleteTab', () => {
    it('should delete tab successfully', async () => {
      const openTab = {
        id: 'tab_123',
        status: 'open',
        totalAmount: '100.00',
        paidAmount: '0.00',
      }

      ;(db.query.tabs.findFirst as jest.Mock).mockResolvedValue(openTab)
      ;(db.delete as jest.Mock).mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      })

      await expect(
        tabsService.deleteTab('tab_123', 'merchant_123')
      ).resolves.not.toThrow()

      expect(db.delete).toHaveBeenCalledWith(tabs)
    })

    it('should prevent deletion of tabs with payments', async () => {
      const paidTab = {
        id: 'tab_123',
        status: 'paid',
        totalAmount: '100.00',
        paidAmount: '100.00',
      }

      ;(db.query.tabs.findFirst as jest.Mock).mockResolvedValue(paidTab)

      await expect(
        tabsService.deleteTab('tab_123', 'merchant_123')
      ).rejects.toThrow(ConflictError)
    })
  })

  describe('updateTabPaymentStatus', () => {
    it('should update payment status correctly', async () => {
      const mockTab = {
        id: 'tab_123',
        totalAmount: '100.00',
        paidAmount: '30.00',
      }

      ;(db.query.tabs.findFirst as jest.Mock).mockResolvedValue(mockTab)
      ;(db.update as jest.Mock).mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      })

      await tabsService.updateTabPaymentStatus('tab_123', 20)

      expect(db.update).toHaveBeenCalledWith(tabs)
      const updateCall = (db.update as jest.Mock).mock.results[0].value.set.mock.calls[0][0]
      expect(updateCall.paidAmount).toBe('50.00')
      expect(updateCall.status).toBe('partial')
    })

    it('should set status to paid when fully paid', async () => {
      const mockTab = {
        id: 'tab_123',
        totalAmount: '100.00',
        paidAmount: '80.00',
      }

      ;(db.query.tabs.findFirst as jest.Mock).mockResolvedValue(mockTab)
      ;(db.update as jest.Mock).mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      })

      await tabsService.updateTabPaymentStatus('tab_123', 20)

      const updateCall = (db.update as jest.Mock).mock.results[0].value.set.mock.calls[0][0]
      expect(updateCall.paidAmount).toBe('100.00')
      expect(updateCall.status).toBe('paid')
    })
  })
})