/**
 * @jest-environment node
 */
import '../test-env-setup.js' // Must be first import
import { NextRequest } from 'next/server'
import { GET as getTabsHandler, POST as postTabsHandler } from '@/app/api/v1/tabs/route'
import { GET as getTabByIdHandler, PATCH as patchTabByIdHandler, DELETE as deleteTabByIdHandler } from '@/app/api/v1/tabs/[id]/route'
import { 
  createAuthenticatedRequest, 
  createTestRequest,
  getResponseData,
  apiAssertions,
} from '../helpers/api-test-helpers'
import { testData } from '../helpers/test-db'
import { getMockedModules } from '../test-env-setup.js'
import crypto from 'crypto'
import * as dbQueries from '@/lib/db/queries'

describe('Tabs API', () => {
  let mocks: ReturnType<typeof getMockedModules>
  let testMerchant: ReturnType<typeof testData.merchant>
  let testApiKey: ReturnType<typeof testData.apiKey>
  
  beforeAll(() => {
    mocks = getMockedModules()
  })
  
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup test data
    testMerchant = testData.merchant()
    testApiKey = testData.apiKey(testMerchant.id)
    
    // Setup default mock for API key validation
    mocks.db.query.apiKeys.findFirst.mockResolvedValue({
      ...testApiKey.record,
      merchant: testMerchant,
    })
  })
  
  describe('POST /api/v1/tabs', () => {
    it('should create a new tab with line items', async () => {
      // Arrange
      const tabData = {
        customerEmail: 'customer@example.com',
        customerName: 'John Doe',
        currency: 'USD',
        taxRate: 0.08,
        lineItems: [
          { description: 'Product A', quantity: 2, unitPrice: 25.00 },
          { description: 'Product B', quantity: 1, unitPrice: 30.00 }
        ]
      }
      
      const expectedTab = testData.tab(testMerchant.id, {
        customerEmail: tabData.customerEmail,
        customerName: tabData.customerName,
        currency: tabData.currency,
        subtotal: '80.00',
        taxAmount: '6.40',
        totalAmount: '86.40',
      })
      
      // Mock successful transaction
      mocks.db.transaction.mockImplementation(async (fn) => {
        const tx = {
          insert: jest.fn().mockReturnValue({
            values: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([expectedTab])
            })
          }),
          query: {
            tabs: {
              findFirst: jest.fn().mockResolvedValue({
                ...expectedTab,
                lineItems: tabData.lineItems.map((item, index) => 
                  testData.lineItem(expectedTab.id, {
                    ...item,
                    totalPrice: (item.quantity * item.unitPrice).toFixed(2)
                  })
                ),
                payments: []
              })
            }
          }
        }
        return fn(tx)
      })
      
      // Act
      const request = createAuthenticatedRequest('/api/v1/tabs', testApiKey.key, {
        method: 'POST',
        body: tabData
      })
      
      const response = await postTabsHandler(request)
      const responseData = await getResponseData(response)
      
      // Assert
      if (response.status !== 201) {
        console.log('Create tab failed:', response.status, JSON.stringify(responseData, null, 2))
      }
      apiAssertions.expectSuccessResponse(response, 201)
      expect(responseData.success).toBe(true)
      expect(responseData.data.tab).toMatchObject({
        id: expectedTab.id,
        customerEmail: tabData.customerEmail,
        totalAmount: '86.40',
        status: 'open',
      })
      expect(responseData.data.paymentUrl).toContain('/pay/')
      expect(responseData.data.tab.lineItems).toHaveLength(2)
    })
    
    it('should return 401 without API key', async () => {
      // Arrange
      const request = createTestRequest('/api/v1/tabs', {
        method: 'POST',
        body: { customerEmail: 'test@example.com', currency: 'USD', lineItems: [] }
      })
      
      // Act
      const response = await postTabsHandler(request)
      
      // Assert
      await apiAssertions.expectErrorResponse(response, 401, 'API key')
    })
    
    it('should validate request data', async () => {
      // Arrange
      const invalidData = {
        customerEmail: 'invalid-email', // Invalid email
        currency: 'INVALID', // Invalid currency
        lineItems: [
          { description: '', quantity: -1, unitPrice: NaN } // Invalid line item
        ]
      }
      
      const request = createAuthenticatedRequest('/api/v1/tabs', testApiKey.key, {
        method: 'POST',
        body: invalidData
      })
      
      // Act
      const response = await postTabsHandler(request)
      
      // Assert
      await apiAssertions.expectErrorResponse(response, 400, 'validation')
    })
    
    it('should validate empty line items', async () => {
      // Arrange
      const tabData = {
        customerEmail: 'customer@example.com',
        currency: 'USD',
        lineItems: [] // This should fail validation
      }
      
      const expectedTab = testData.tab(testMerchant.id, {
        customerEmail: tabData.customerEmail,
        currency: tabData.currency,
        subtotal: '0.00',
        taxAmount: '0.00',
        totalAmount: '0.00',
      })
      
      mocks.db.transaction.mockImplementation(async (fn) => {
        const tx = {
          insert: jest.fn().mockReturnValue({
            values: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([expectedTab])
            })
          }),
          query: {
            tabs: {
              findFirst: jest.fn().mockResolvedValue({
                ...expectedTab,
                lineItems: [],
                payments: []
              })
            }
          }
        }
        return fn(tx)
      })
      
      const request = createAuthenticatedRequest('/api/v1/tabs', testApiKey.key, {
        method: 'POST',
        body: tabData
      })
      
      // Act
      const response = await postTabsHandler(request)
      const responseData = await getResponseData(response)
      
      // Assert - expecting validation error for empty line items
      await apiAssertions.expectErrorResponse(response, 400, 'validation')
    })
    
    it('should create tab with minimal line item', async () => {
      // Arrange
      const tabData = {
        customerEmail: 'customer@example.com',
        currency: 'USD',
        lineItems: [
          { description: 'Free item', quantity: 1, unitPrice: 0.01 } // Minimum positive price
        ]
      }
      
      const expectedTab = testData.tab(testMerchant.id, {
        customerEmail: tabData.customerEmail,
        currency: tabData.currency,
        subtotal: '0.01',
        taxAmount: '0.00',
        totalAmount: '0.01',
      })
      
      mocks.db.transaction.mockImplementation(async (fn) => {
        const tx = {
          insert: jest.fn().mockReturnValue({
            values: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([expectedTab])
            })
          }),
          query: {
            tabs: {
              findFirst: jest.fn().mockResolvedValue({
                ...expectedTab,
                lineItems: [testData.lineItem(expectedTab.id, {
                  ...tabData.lineItems[0],
                  totalPrice: '0.01'
                })],
                payments: []
              })
            }
          }
        }
        return fn(tx)
      })
      
      const request = createAuthenticatedRequest('/api/v1/tabs', testApiKey.key, {
        method: 'POST',
        body: tabData
      })
      
      // Act
      const response = await postTabsHandler(request)
      const responseData = await getResponseData(response)
      
      // Assert
      apiAssertions.expectSuccessResponse(response, 201)
      expect(responseData.data.tab.totalAmount).toBe('0.01')
    })
  })
  
  describe('GET /api/v1/tabs', () => {
    it('should return paginated tabs for merchant', async () => {
      // Arrange
      const mockTabs = [
        testData.tab(testMerchant.id, { status: 'open' }),
        testData.tab(testMerchant.id, { status: 'paid' }),
      ]
      
      mocks.db.query.tabs.findMany.mockResolvedValue(
        mockTabs.map(tab => ({ ...tab, lineItems: [], payments: [] }))
      )
      
      // Mock countRows which is imported separately
      jest.mocked(dbQueries.countRows).mockResolvedValue(2)
      
      const request = createAuthenticatedRequest('/api/v1/tabs', testApiKey.key, {
        searchParams: { page: '1', limit: '10' }
      })
      
      // Act
      const response = await getTabsHandler(request)
      const responseData = await getResponseData(response)
      
      if (response.status !== 200) {
        console.log('GET tabs failed:', response.status, JSON.stringify(responseData, null, 2))
      }
      
      // Assert
      apiAssertions.expectSuccessResponse(response)
      await apiAssertions.expectPaginatedResponse(response)
      expect(responseData.data).toHaveLength(2)
      expect(responseData.meta).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1
      })
    })
    
    it('should filter tabs by status', async () => {
      // Arrange
      const paidTabs = [testData.tab(testMerchant.id, { status: 'paid' })]
      
      mocks.db.query.tabs.findMany.mockResolvedValue(
        paidTabs.map(tab => ({ ...tab, lineItems: [], payments: [] }))
      )
      
      jest.mocked(dbQueries.countRows).mockResolvedValue(1)
      
      const request = createAuthenticatedRequest('/api/v1/tabs', testApiKey.key, {
        searchParams: { status: 'paid' }
      })
      
      // Act
      const response = await getTabsHandler(request)
      const responseData = await getResponseData(response)
      
      // Assert
      apiAssertions.expectSuccessResponse(response)
      expect(responseData.data).toHaveLength(1)
      expect(responseData.data[0].status).toBe('paid')
    })
    
    it('should handle invalid pagination parameters', async () => {
      // Arrange
      const request = createAuthenticatedRequest('/api/v1/tabs', testApiKey.key, {
        searchParams: { page: '-1', limit: '1000' } // Invalid values
      })
      
      mocks.db.query.tabs.findMany.mockResolvedValue([])
      jest.mocked(dbQueries.countRows).mockResolvedValue(0)
      
      // Act
      const response = await getTabsHandler(request)
      
      // Assert
      // Should either handle gracefully or return validation error
      expect(response.status).toBeLessThanOrEqual(400)
    })
  })
  
  describe('GET /api/v1/tabs/[id]', () => {
    it('should return tab details with line items', async () => {
      // Arrange
      const tab = testData.tab(testMerchant.id)
      const lineItems = [
        testData.lineItem(tab.id, { description: 'Item 1', unitPrice: 50.00 }),
        testData.lineItem(tab.id, { description: 'Item 2', unitPrice: 30.00 })
      ]
      
      mocks.db.query.tabs.findFirst.mockResolvedValue({
        ...tab,
        lineItems,
        payments: []
      })
      
      const params = Promise.resolve({ id: tab.id })
      const request = createAuthenticatedRequest(`/api/v1/tabs/${tab.id}`, testApiKey.key)
      
      // Act
      const response = await getTabByIdHandler(request, { params })
      const responseData = await getResponseData(response)
      
      // Assert
      apiAssertions.expectSuccessResponse(response)
      expect(responseData.data.id).toBe(tab.id)
      expect(responseData.data.lineItems).toHaveLength(2)
    })
    
    it('should return 404 for non-existent tab', async () => {
      // Arrange
      mocks.db.query.tabs.findFirst.mockResolvedValue(null)
      
      const params = Promise.resolve({ id: 'non-existent' })
      const request = createAuthenticatedRequest('/api/v1/tabs/non-existent', testApiKey.key)
      
      // Act
      const response = await getTabByIdHandler(request, { params })
      
      // Assert
      await apiAssertions.expectErrorResponse(response, 404)
    })
  })
  
  describe('PATCH /api/v1/tabs/[id]', () => {
    it('should update tab status', async () => {
      // Arrange
      const existingTab = testData.tab(testMerchant.id, { status: 'open' })
      const updates = { status: 'paid' as const }
      
      mocks.db.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{
              ...existingTab,
              ...updates,
              updatedAt: new Date()
            }])
          })
        })
      })
      
      mocks.db.query.tabs.findFirst.mockResolvedValue({
        ...existingTab,
        ...updates,
        lineItems: [],
        payments: []
      })
      
      const params = Promise.resolve({ id: existingTab.id })
      const request = createAuthenticatedRequest(`/api/v1/tabs/${existingTab.id}`, testApiKey.key, {
        method: 'PATCH',
        body: updates
      })
      
      // Act
      const response = await patchTabByIdHandler(request, { params })
      const responseData = await getResponseData(response)
      
      // Assert
      apiAssertions.expectSuccessResponse(response)
      expect(responseData.data.status).toBe('paid')
    })
    
    it('should return 404 for non-existent tab', async () => {
      // Arrange
      mocks.db.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([])
          })
        })
      })
      
      const params = Promise.resolve({ id: 'non-existent' })
      const request = createAuthenticatedRequest('/api/v1/tabs/non-existent', testApiKey.key, {
        method: 'PATCH',
        body: { status: 'paid' }
      })
      
      // Act
      const response = await patchTabByIdHandler(request, { params })
      
      // Assert
      await apiAssertions.expectErrorResponse(response, 404)
    })
    
    it('should validate update data', async () => {
      // Arrange
      const existingTab = testData.tab(testMerchant.id)
      const invalidUpdates = { status: 'invalid-status' as any }
      
      const params = Promise.resolve({ id: existingTab.id })
      const request = createAuthenticatedRequest(`/api/v1/tabs/${existingTab.id}`, testApiKey.key, {
        method: 'PATCH',
        body: invalidUpdates
      })
      
      // Act
      const response = await patchTabByIdHandler(request, { params })
      
      // Assert
      await apiAssertions.expectErrorResponse(response, 400)
    })
  })
  
  describe('DELETE /api/v1/tabs/[id]', () => {
    it('should delete a tab', async () => {
      // Arrange
      const tabToDelete = testData.tab(testMerchant.id)
      
      mocks.db.delete.mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([tabToDelete])
        })
      })
      
      const params = Promise.resolve({ id: tabToDelete.id })
      const request = createAuthenticatedRequest(`/api/v1/tabs/${tabToDelete.id}`, testApiKey.key, {
        method: 'DELETE'
      })
      
      // Act
      const response = await deleteTabByIdHandler(request, { params })
      
      // Assert
      apiAssertions.expectSuccessResponse(response, 200)
    })
    
    it('should return 404 when deleting non-existent tab', async () => {
      // Arrange
      // Mock the findFirst to return null (tab doesn't exist)
      mocks.db.query.tabs.findFirst.mockResolvedValue(null)
      
      const params = Promise.resolve({ id: 'non-existent' })
      const request = createAuthenticatedRequest('/api/v1/tabs/non-existent', testApiKey.key, {
        method: 'DELETE'
      })
      
      // Act
      const response = await deleteTabByIdHandler(request, { params })
      
      // Assert
      await apiAssertions.expectErrorResponse(response, 404)
    })
  })
})