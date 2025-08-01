/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { createDrizzleMock, mockDrizzleResponse } from '@/__tests__/helpers/drizzle-mock'

// Create the mock before any imports
const mockDb = createDrizzleMock()

// Mock dependencies
jest.mock('@/lib/db/client', () => ({
  db: mockDb
}))

jest.mock('@/lib/api/organization-middleware', () => ({
  withOrganizationAuth: jest.fn((handler) => {
    return async (request: NextRequest, context: any) => {
      const apiKey = request.headers.get('x-api-key')
      if (!apiKey) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      const mockContext = {
        organizationId: 'org_123',
        organization: {
          id: 'org_123',
          name: 'Test Organization',
          isMerchant: true,
          merchantId: 'merchant_123'
        },
        user: { id: 'user_123', email: 'test@example.com' },
        role: 'owner'
      }
      
      return handler(request, mockContext, context)
    }
  })
}))

jest.mock('@/lib/db/queries', () => ({
  countRows: jest.fn().mockResolvedValue(10)
}))

jest.mock('@/lib/services/customer-targeting.service', () => ({
  CustomerTargetingService: {
    validateCustomerTargeting: jest.fn().mockReturnValue({ isValid: true })
  }
}))

jest.mock('@/lib/utils/index', () => ({
  TAX_RATE: 0.1,
  calculateTabBalance: jest.fn().mockReturnValue(0),
  getTabStatus: jest.fn().mockReturnValue('open'),
  PAGINATION_MAX_LIMIT: 100
}))

// Import route handlers after mocks
import { GET, POST } from '@/app/api/v1/tabs/route'
import { GET as getTab, PUT as updateTab, DELETE as deleteTab } from '@/app/api/v1/tabs/[id]/route'

describe('Tab API - Fixed Tests', () => {
  const mockTab = {
    id: 'tab_123',
    organizationId: 'org_123',
    status: 'open',
    currency: 'USD',
    totalAmount: '100.00',
    subtotal: '90.91',
    taxAmount: '9.09',
    paidAmount: '0.00',
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    customerOrganizationId: null,
    externalReference: null,
    metadata: null,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01')
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/v1/tabs', () => {
    it('should return paginated tabs', async () => {
      // Mock the relational query that the API uses
      mockDrizzleResponse(mockDb, 'tabs', 'findMany', [{
        ...mockTab,
        lineItems: [],
        payments: [],
        customerOrganization: null
      }])

      const request = new NextRequest('http://localhost/api/v1/tabs', {
        method: 'GET',
        headers: {
          'x-api-key': 'tab_test_12345678901234567890123456789012'
        }
      })

      const response = await GET(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data).toHaveProperty('data')
      expect(data).toHaveProperty('pagination')
      expect(data.data).toHaveLength(1)
      expect(data.data[0].id).toBe('tab_123')
    })

    it('should handle authentication errors', async () => {
      const request = new NextRequest('http://localhost/api/v1/tabs', {
        method: 'GET',
        headers: {} // No API key
      })

      const response = await GET(request)
      expect(response.status).toBe(401)
      
      const data = await response.json()
      expect(data.error).toContain('Authentication required')
    })

    it('should support pagination parameters', async () => {
      mockDrizzleResponse(mockDb, 'tabs', 'findMany', [])

      const request = new NextRequest('http://localhost/api/v1/tabs?page=2&pageSize=50', {
        method: 'GET',
        headers: {
          'x-api-key': 'tab_test_12345678901234567890123456789012'
        }
      })

      const response = await GET(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.pagination.page).toBe(2)
      expect(data.pagination.pageSize).toBe(50)
    })

    it('should filter by status', async () => {
      mockDrizzleResponse(mockDb, 'tabs', 'findMany', [
        { ...mockTab, status: 'open' }
      ])

      const request = new NextRequest('http://localhost/api/v1/tabs?status=open', {
        method: 'GET',
        headers: {
          'x-api-key': 'tab_test_12345678901234567890123456789012'
        }
      })

      const response = await GET(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.data).toHaveLength(1)
      expect(data.data[0].status).toBe('open')
    })
  })

  describe('POST /api/v1/tabs', () => {
    it('should create a new tab', async () => {
      // Mock transaction
      mockDb.transaction.mockImplementationOnce(async (callback) => {
        // Mock the insert operation inside transaction
        const mockInsert = {
          values: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([mockTab])
          })
        }
        
        const txMock = {
          ...mockDb,
          insert: jest.fn().mockReturnValue(mockInsert)
        }
        
        return callback(txMock)
      })

      // Mock the findFirst query to return the created tab
      mockDrizzleResponse(mockDb, 'tabs', 'findFirst', {
        ...mockTab,
        lineItems: []
      })

      const request = new NextRequest('http://localhost/api/v1/tabs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': 'tab_test_12345678901234567890123456789012'
        },
        body: JSON.stringify({
          customerName: 'John Doe',
          customerEmail: 'john@example.com',
          currency: 'USD',
          lineItems: [
            {
              description: 'Product 1',
              quantity: 1,
              unitPrice: 100
            }
          ]
        })
      })

      const response = await POST(request)
      expect(response.status).toBe(201)
      
      const data = await response.json()
      expect(data.id).toBe('tab_123')
      expect(data.customerName).toBe('John Doe')
    })

    it('should validate required fields', async () => {
      const request = new NextRequest('http://localhost/api/v1/tabs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': 'tab_test_12345678901234567890123456789012'
        },
        body: JSON.stringify({
          // Missing required fields
          customerName: 'John'
        })
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.error).toBeDefined()
    })
  })

  describe('GET /api/v1/tabs/[id]', () => {
    it('should retrieve a single tab', async () => {
      mockDrizzleResponse(mockDb, 'tabs', 'findFirst', {
        ...mockTab,
        lineItems: [],
        payments: []
      })

      const request = new NextRequest('http://localhost/api/v1/tabs/tab_123', {
        headers: {
          'x-api-key': 'tab_test_12345678901234567890123456789012'
        }
      })

      const response = await getTab(request, { params: { id: 'tab_123' } })
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.id).toBe('tab_123')
      expect(data.customerName).toBe('John Doe')
    })

    it('should return 404 for non-existent tab', async () => {
      mockDrizzleResponse(mockDb, 'tabs', 'findFirst', null)

      const request = new NextRequest('http://localhost/api/v1/tabs/invalid', {
        headers: {
          'x-api-key': 'tab_test_12345678901234567890123456789012'
        }
      })

      const response = await getTab(request, { params: { id: 'invalid' } })
      expect(response.status).toBe(404)
      
      const data = await response.json()
      expect(data.error).toContain('not found')
    })
  })

  describe('PUT /api/v1/tabs/[id]', () => {
    it('should update a tab', async () => {
      // Mock finding the tab
      mockDrizzleResponse(mockDb, 'tabs', 'findFirst', mockTab)

      // Mock the update operation
      mockDb.update.mockReturnValueOnce({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{
              ...mockTab,
              customerName: 'Jane Doe'
            }])
          })
        })
      })

      const request = new NextRequest('http://localhost/api/v1/tabs/tab_123', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'x-api-key': 'tab_test_12345678901234567890123456789012'
        },
        body: JSON.stringify({
          customerName: 'Jane Doe'
        })
      })

      const response = await updateTab(request, { params: { id: 'tab_123' } })
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.customerName).toBe('Jane Doe')
    })

    it('should not update closed tabs', async () => {
      mockDrizzleResponse(mockDb, 'tabs', 'findFirst', {
        ...mockTab,
        status: 'closed'
      })

      const request = new NextRequest('http://localhost/api/v1/tabs/tab_123', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'x-api-key': 'tab_test_12345678901234567890123456789012'
        },
        body: JSON.stringify({
          customerName: 'Jane Doe'
        })
      })

      const response = await updateTab(request, { params: { id: 'tab_123' } })
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.error).toContain('closed')
    })
  })

  describe('DELETE /api/v1/tabs/[id]', () => {
    it('should delete a tab without payments', async () => {
      mockDrizzleResponse(mockDb, 'tabs', 'findFirst', {
        ...mockTab,
        payments: []
      })

      // Mock the transaction for deletion
      mockDb.transaction.mockImplementationOnce(async (callback) => {
        const txMock = {
          ...mockDb,
          delete: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              execute: jest.fn().mockResolvedValue(undefined)
            })
          })
        }
        return callback(txMock)
      })

      const request = new NextRequest('http://localhost/api/v1/tabs/tab_123', {
        method: 'DELETE',
        headers: {
          'x-api-key': 'tab_test_12345678901234567890123456789012'
        }
      })

      const response = await deleteTab(request, { params: { id: 'tab_123' } })
      expect(response.status).toBe(204)
    })

    it('should not delete tabs with payments', async () => {
      mockDrizzleResponse(mockDb, 'tabs', 'findFirst', {
        ...mockTab,
        paidAmount: '50.00',
        payments: [{ id: 'payment_1', amount: '50.00' }]
      })

      const request = new NextRequest('http://localhost/api/v1/tabs/tab_123', {
        method: 'DELETE',
        headers: {
          'x-api-key': 'tab_test_12345678901234567890123456789012'
        }
      })

      const response = await deleteTab(request, { params: { id: 'tab_123' } })
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.error).toContain('payments')
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock a database error
      mockDb.query.tabs.findMany.mockRejectedValueOnce(new Error('Database connection failed'))

      const request = new NextRequest('http://localhost/api/v1/tabs', {
        headers: {
          'x-api-key': 'tab_test_12345678901234567890123456789012'
        }
      })

      const response = await GET(request)
      expect(response.status).toBe(500)
      
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it('should handle invalid JSON in request body', async () => {
      const request = new NextRequest('http://localhost/api/v1/tabs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': 'tab_test_12345678901234567890123456789012'
        },
        body: '{ invalid json'
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.error).toContain('Invalid request')
    })
  })
})