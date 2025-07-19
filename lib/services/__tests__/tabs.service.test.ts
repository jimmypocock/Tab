import '../../../__tests__/test-env-setup.js' // Must be first import
import { tabsService } from '../tabs.service'
import { CreateTabInput, UpdateTabInput } from '@/lib/api/validation'
import { NotFoundError, ConflictError, DatabaseError } from '@/lib/errors'
import { TAX_RATE } from '@/lib/utils'
import { getMockedModules } from '../../../__tests__/test-env-setup.js'
import { testData } from '../../../__tests__/helpers/test-db'

describe('TabsService', () => {
  let mocks: ReturnType<typeof getMockedModules>
  let testMerchant: ReturnType<typeof testData.merchant>
  
  beforeAll(() => {
    mocks = getMockedModules()
  })
  
  beforeEach(() => {
    jest.clearAllMocks()
    testMerchant = testData.merchant()
  })

  describe('createTab', () => {
    const mockTabInput: CreateTabInput = {
      customerEmail: 'test@example.com',
      customerName: 'Test Customer',
      currency: 'USD',
      lineItems: [
        {
          description: 'Item 1',
          quantity: 2,
          unitPrice: 25.00,
        },
        {
          description: 'Item 2',
          quantity: 1,
          unitPrice: 50.00,
        },
      ],
    }

    it('should create a tab with correct calculations', async () => {
      // Arrange
      const expectedSubtotal = 100 // (2 * 25) + (1 * 50)
      const expectedTax = expectedSubtotal * TAX_RATE
      const expectedTotal = expectedSubtotal + expectedTax
      
      const createdTab = testData.tab(testMerchant.id, {
        subtotal: expectedSubtotal.toFixed(2),
        taxAmount: expectedTax.toFixed(2),
        totalAmount: expectedTotal.toFixed(2),
      })
      
      mocks.db.transaction.mockResolvedValue({
        ...createdTab,
        lineItems: mockTabInput.lineItems!.map((item, index) => 
          testData.lineItem(createdTab.id, {
            ...item,
            totalPrice: (item.quantity * item.unitPrice).toFixed(2)
          })
        ),
        payments: [],
      })

      // Act
      const result = await tabsService.createTab(testMerchant.id, mockTabInput)

      // Assert
      expect(result).toBeDefined()
      expect(result.totalAmount).toBe(expectedTotal.toFixed(2))
      expect(result.status).toBe('open')
      expect(mocks.db.transaction).toHaveBeenCalled()
    })

    it('should use custom tax rate when provided', async () => {
      // Arrange
      const inputWithTax = {
        ...mockTabInput,
        taxRate: 0.15,
      }
      
      const expectedSubtotal = 100
      const expectedTax = expectedSubtotal * 0.15
      const expectedTotal = expectedSubtotal + expectedTax
      
      const createdTab = testData.tab(testMerchant.id, {
        subtotal: expectedSubtotal.toFixed(2),
        taxAmount: expectedTax.toFixed(2),
        totalAmount: expectedTotal.toFixed(2),
      })

      mocks.db.transaction.mockResolvedValue({
        ...createdTab,
        lineItems: [],
        payments: [],
      })

      // Act
      const result = await tabsService.createTab(testMerchant.id, inputWithTax)

      // Assert
      expect(result.totalAmount).toBe(expectedTotal.toFixed(2))
    })

    it('should handle database errors', async () => {
      // Arrange
      mocks.db.transaction.mockRejectedValue(new Error('Database connection failed'))

      // Act & Assert
      await expect(
        tabsService.createTab(testMerchant.id, mockTabInput)
      ).rejects.toThrow(DatabaseError)
    })

    it('should create tab without line items', async () => {
      // Arrange
      const inputWithoutItems: CreateTabInput = {
        customerEmail: 'test@example.com',
        currency: 'USD',
        lineItems: [],
      }
      
      const createdTab = testData.tab(testMerchant.id, {
        subtotal: '0.00',
        taxAmount: '0.00',
        totalAmount: '0.00',
      })

      mocks.db.transaction.mockResolvedValue({
        ...createdTab,
        lineItems: [],
        payments: [],
      })

      // Act
      const result = await tabsService.createTab(testMerchant.id, inputWithoutItems)

      // Assert
      expect(result.totalAmount).toBe('0.00')
    })
  })

  describe('getTab', () => {
    it('should fetch a tab with computed fields', async () => {
      // Arrange
      const mockTab = testData.tab(testMerchant.id, {
        totalAmount: '100.00',
        paidAmount: '30.00',
        status: 'partial',
      })

      mocks.db.query.tabs.findFirst.mockResolvedValue({
        ...mockTab,
        lineItems: [],
        payments: [],
      })

      // Act
      const result = await tabsService.getTab(mockTab.id, testMerchant.id)

      // Assert
      expect(result).toMatchObject({
        ...mockTab,
        balance: 70,
        computedStatus: 'partial',
      })
      expect(mocks.db.query.tabs.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'and',
            conditions: expect.arrayContaining([
              expect.objectContaining({ type: 'eq' }),
              expect.objectContaining({ type: 'eq' })
            ])
          }),
          with: expect.objectContaining({
            lineItems: expect.any(Object),
            payments: expect.any(Object),
          }),
        })
      )
    })

    it('should return null for non-existent tab', async () => {
      // Arrange
      mocks.db.query.tabs.findFirst.mockResolvedValue(null)

      // Act
      const result = await tabsService.getTab('non-existent', testMerchant.id)

      // Assert
      expect(result).toBeNull()
    })

    it('should include line items and payments', async () => {
      // Arrange
      const mockTab = testData.tab(testMerchant.id)
      const mockLineItems = [
        testData.lineItem(mockTab.id),
        testData.lineItem(mockTab.id),
      ]
      const mockPayments = [
        testData.payment(mockTab.id, { amount: '50.00' }),
      ]

      mocks.db.query.tabs.findFirst.mockResolvedValue({
        ...mockTab,
        lineItems: mockLineItems,
        payments: mockPayments,
      })

      // Act
      const result = await tabsService.getTab(mockTab.id, testMerchant.id)

      // Assert
      expect(result?.lineItems).toHaveLength(2)
      expect(result?.payments).toHaveLength(1)
    })
  })

  describe('updateTab', () => {
    it('should update tab successfully', async () => {
      // Arrange
      const existingTab = testData.tab(testMerchant.id, {
        status: 'open',
        totalAmount: '100.00',
        paidAmount: '0.00',
      })
      
      const updates: UpdateTabInput = {
        status: 'partial',
      }

      // Mock getTab
      mocks.db.query.tabs.findFirst.mockResolvedValueOnce({
        ...existingTab,
        lineItems: [],
        payments: [],
      })

      // Mock update
      mocks.db.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{
              ...existingTab,
              ...updates,
              updatedAt: new Date(),
            }])
          })
        })
      })

      // Mock getTab for final fetch
      mocks.db.query.tabs.findFirst.mockResolvedValueOnce({
        ...existingTab,
        ...updates,
        lineItems: [],
        payments: [],
      })

      // Act
      const result = await tabsService.updateTab(existingTab.id, testMerchant.id, updates)

      // Assert
      expect(result.status).toBe('partial')
    })

    it('should throw NotFoundError for non-existent tab', async () => {
      // Arrange
      mocks.db.query.tabs.findFirst.mockResolvedValue(null)

      // Act & Assert
      await expect(
        tabsService.updateTab('non-existent', testMerchant.id, { status: 'paid' })
      ).rejects.toThrow(NotFoundError)
    })

    it('should validate status transitions', async () => {
      // Arrange
      const paidTab = testData.tab(testMerchant.id, {
        status: 'paid',
        totalAmount: '100.00',
        paidAmount: '100.00',
      })

      mocks.db.query.tabs.findFirst.mockResolvedValue({
        ...paidTab,
        lineItems: [],
        payments: [],
      })

      // Act & Assert
      await expect(
        tabsService.updateTab(paidTab.id, testMerchant.id, { status: 'open' })
      ).rejects.toThrow(ConflictError)
    })

    it('should allow valid status transitions', async () => {
      // Test open -> partial
      const openTab = testData.tab(testMerchant.id, { status: 'open' })
      
      mocks.db.query.tabs.findFirst.mockResolvedValueOnce({
        ...openTab,
        lineItems: [],
        payments: [],
      })

      mocks.db.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{ ...openTab, status: 'partial' }])
          })
        })
      })

      mocks.db.query.tabs.findFirst.mockResolvedValueOnce({
        ...openTab,
        status: 'partial',
        lineItems: [],
        payments: [],
      })

      const result = await tabsService.updateTab(openTab.id, testMerchant.id, { status: 'partial' })
      expect(result.status).toBe('partial')
    })
  })

  describe('deleteTab', () => {
    it('should delete tab successfully', async () => {
      // Arrange
      const openTab = testData.tab(testMerchant.id, {
        status: 'open',
        paidAmount: '0.00',
      })

      mocks.db.query.tabs.findFirst.mockResolvedValue({
        ...openTab,
        lineItems: [],
        payments: [],
      })
      
      mocks.db.delete.mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([openTab])
        })
      })

      // Act
      await tabsService.deleteTab(openTab.id, testMerchant.id)

      // Assert
      expect(mocks.db.delete).toHaveBeenCalled()
    })

    it('should prevent deletion of tabs with payments', async () => {
      // Arrange
      const paidTab = testData.tab(testMerchant.id, {
        status: 'partial',
        totalAmount: '100.00',
        paidAmount: '50.00',
      })

      mocks.db.query.tabs.findFirst.mockResolvedValue({
        ...paidTab,
        lineItems: [],
        payments: [],
      })

      // Act & Assert
      await expect(
        tabsService.deleteTab(paidTab.id, testMerchant.id)
      ).rejects.toThrow(ConflictError)
    })

    it('should throw NotFoundError for non-existent tab', async () => {
      // Arrange
      mocks.db.query.tabs.findFirst.mockResolvedValue(null)

      // Act & Assert
      await expect(
        tabsService.deleteTab('non-existent', testMerchant.id)
      ).rejects.toThrow(NotFoundError)
    })
  })

  describe('updateTabPaymentStatus', () => {
    it('should update payment status correctly', async () => {
      // Arrange
      const tabId = 'tab_123'
      const paymentAmount = 50.00
      
      // Mock existing tab
      const existingTab = testData.tab(testMerchant.id, {
        id: tabId,
        totalAmount: '100.00',
        paidAmount: '30.00',
        status: 'partial',
      })
      
      mocks.db.query.tabs.findFirst.mockResolvedValue(existingTab)

      // Mock update
      mocks.db.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined)
        })
      })

      // Act
      await tabsService.updateTabPaymentStatus(tabId, paymentAmount)

      // Assert
      expect(mocks.db.update).toHaveBeenCalledWith(expect.anything())
      expect(mocks.db.update().set).toHaveBeenCalledWith({
        paidAmount: '80.00', // 30 + 50
        status: 'partial',
        updatedAt: expect.any(Date)
      })
    })

    it('should set status to paid when fully paid', async () => {
      // Arrange
      const tabId = 'tab_123'
      const paymentAmount = 50.00
      
      // Mock existing tab that will be fully paid
      const existingTab = testData.tab(testMerchant.id, {
        id: tabId,
        totalAmount: '100.00',
        paidAmount: '50.00',
        status: 'partial',
      })
      
      mocks.db.query.tabs.findFirst.mockResolvedValue(existingTab)

      // Mock update
      mocks.db.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined)
        })
      })

      // Act
      await tabsService.updateTabPaymentStatus(tabId, paymentAmount)

      // Assert
      expect(mocks.db.update().set).toHaveBeenCalledWith({
        paidAmount: '100.00', // 50 + 50
        status: 'paid',
        updatedAt: expect.any(Date)
      })
    })

    it('should handle zero payment amount', async () => {
      // Arrange
      const tabId = 'tab_123'
      const paymentAmount = 0
      
      // Mock existing tab
      const existingTab = testData.tab(testMerchant.id, {
        id: tabId,
        totalAmount: '100.00',
        paidAmount: '0.00',
        status: 'open',
      })
      
      mocks.db.query.tabs.findFirst.mockResolvedValue(existingTab)

      // Mock update
      mocks.db.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined)
        })
      })

      // Act
      await tabsService.updateTabPaymentStatus(tabId, paymentAmount)

      // Assert
      expect(mocks.db.update().set).toHaveBeenCalledWith({
        paidAmount: '0.00',
        status: 'open',
        updatedAt: expect.any(Date)
      })
    })
    
    it('should throw DatabaseError for non-existent tab', async () => {
      // Arrange
      mocks.db.query.tabs.findFirst.mockResolvedValue(null)
      
      // Act & Assert
      await expect(
        tabsService.updateTabPaymentStatus('non-existent', 10)
      ).rejects.toThrow(DatabaseError)
    })
  })
})