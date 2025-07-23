/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/v1/tabs/route'
import { GET as getTab, PUT as updateTab, DELETE as deleteTab } from '@/app/api/v1/tabs/[id]/route'
import { countRows } from '@/lib/db/queries'

// Mock the middleware
jest.mock('@/lib/api/organization-middleware', () => ({
  withOrganizationAuth: jest.fn((request, handler, options) => {
    // Check if API key is provided
    const apiKey = request.headers.get('x-api-key')
    
    if (!apiKey) {
      // Return 401 if no API key
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Mock organization context
    const mockContext = {
      organizationId: 'org_123',
      organization: {
        id: 'org_123',
        name: 'Test Organization',
        isMerchant: true,
        merchantId: 'merchant_123'
      },
      user: {
        id: 'user_123',
        email: 'test@example.com'
      },
      role: 'owner'
    }
    return handler(request, mockContext)
  })
}))

// Mock database client
jest.mock('@/lib/db/client', () => ({
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    and: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    transaction: jest.fn(),
    query: {
      tabs: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      merchants: {
        findFirst: jest.fn(),
      },
      lineItems: {
        findMany: jest.fn(),
      },
      organizations: {
        findFirst: jest.fn()
      }
    }
  }
}))

// Mock other dependencies
jest.mock('@/lib/db/queries', () => ({
  countRows: jest.fn().mockResolvedValue(1)
}))

jest.mock('@/lib/services/customer-targeting.service', () => ({
  CustomerTargetingService: {
    validateCustomerTargeting: jest.fn().mockReturnValue({ isValid: true })
  }
}))

jest.mock('@/lib/api/field-selection', () => ({
  parseFieldSelection: jest.fn().mockReturnValue(null),
  applyFieldSelection: jest.fn((data) => data),
  DefaultFields: { tab: new Set(['id', 'status']) },
  validateFieldSelection: jest.fn().mockReturnValue({ valid: true })
}))

jest.mock('@/lib/utils/index', () => ({
  TAX_RATE: 0.1,
  calculateTabBalance: jest.fn().mockReturnValue(0),
  getTabStatus: jest.fn().mockReturnValue('open'),
  PAGINATION_MAX_LIMIT: 100
}))

// Mock Supabase client for auth
jest.mock('@/lib/supabase/client', () => ({
  createServiceClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: { 
              id: 'test-merchant-id',
              businessName: 'Test Business' 
            },
            error: null
          }))
        }))
      }))
    }))
  }))
}))

import { db } from '@/lib/db/client'
const mockDb = db as jest.Mocked<typeof db>

describe('/api/v1/tabs', () => {
  const mockMerchant = {
    id: 'merchant_123',
    businessName: 'Test Business',
    stripeAccountId: 'acct_test123'
  }

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

  const mockLineItems = [
    {
      id: 'item_1',
      tabId: 'tab_123',
      description: 'Coffee',
      unitPrice: '5.00',
      quantity: 2,
      total: '10.00',
      metadata: null,
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01')
    }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET - List Tabs', () => {
    it('should return merchant tabs successfully', async () => {
      // Mock database query response
      mockDb.query.tabs.findMany.mockResolvedValue([{
        ...mockTab,
        lineItems: [],
        payments: [],
        customerOrganization: null
      }])

      const request = new NextRequest('http://localhost/api/v1/tabs', {
        method: 'GET',
        headers: {
          'X-API-Key': 'tab_test_12345678901234567890123456789012'
        }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(Array.isArray(data.data)).toBe(true)
      expect(data.data.length).toBe(1)
      expect(data.data[0]).toMatchObject({
        id: 'tab_123',
        status: 'open',
        totalAmount: '100.00',
        customerName: 'John Doe'
      })
    })

    it('should support pagination', async () => {
      const tabs = Array.from({ length: 25 }, (_, i) => ({
        ...mockTab,
        id: `tab_${i}`,
        customerName: `Customer ${i}`
      }))
      
      mockDb.query.tabs.findMany.mockResolvedValue(tabs.slice(0, 20))
      ;(countRows as jest.Mock).mockResolvedValue(25)

      const request = new NextRequest('http://localhost/api/v1/tabs?limit=20&offset=0', {
        method: 'GET',
        headers: {
          'X-API-Key': 'tab_test_12345678901234567890123456789012'
        }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(20)
      expect(data.meta).toMatchObject({
        limit: 20,
        page: 1,
        total: 25,
        totalPages: 2
      })
    })

    it('should filter by status', async () => {
      const openTabs = [{ ...mockTab, status: 'open' }]
      mockDb.query.tabs.findMany.mockResolvedValue(openTabs)

      const request = new NextRequest('http://localhost/api/v1/tabs?status=open', {
        method: 'GET',
        headers: {
          'X-API-Key': 'tab_test_12345678901234567890123456789012'
        }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(1)
      expect(data.data[0].status).toBe('open')
    })

    it('should require valid API key', async () => {
      const request = new NextRequest('http://localhost/api/v1/tabs', {
        method: 'GET'
        // Missing API key
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Authentication required')
    })
  })

  describe('POST - Create Tab', () => {
    it('should create tab successfully', async () => {
      const newTabMock = {
        id: 'tab_new',
        organizationId: 'org_123',
        status: 'open',
        currency: 'USD',
        totalAmount: '5.50',
        subtotal: '5.00',
        taxAmount: '0.50',
        customerName: 'Jane Doe',
        customerEmail: 'jane@example.com',
        lineItems: [],
        customerOrganization: null
      }

      // Mock transaction
      mockDb.transaction.mockImplementation(async (callback) => {
        return callback({
          insert: jest.fn().mockReturnValue({
            values: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([newTabMock])
            })
          }),
          query: {
            tabs: {
              findFirst: jest.fn().mockResolvedValue(newTabMock)
            }
          }
        })
      })

      const request = new NextRequest('http://localhost/api/v1/tabs', {
        method: 'POST',
        headers: {
          'X-API-Key': 'tab_test_12345678901234567890123456789012',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customerName: 'Jane Doe',
          customerEmail: 'jane@example.com',
          currency: 'USD',
          lineItems: [{
            description: 'Test Item',
            quantity: 1,
            unitPrice: 5.00
          }]
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.tab).toMatchObject({
        id: 'tab_new',
        customerName: 'Jane Doe',
        customerEmail: 'jane@example.com'
      })
    })

    it('should validate required fields', async () => {
      const request = new NextRequest('http://localhost/api/v1/tabs', {
        method: 'POST',
        headers: {
          'X-API-Key': 'tab_test_12345678901234567890123456789012',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Missing customerName, customerEmail, and lineItems (all required)
          currency: 'USD'
        })
      })

      await expect(POST(request)).rejects.toThrow('Invalid request data')
    })

    it('should validate email format', async () => {
      const request = new NextRequest('http://localhost/api/v1/tabs', {
        method: 'POST',
        headers: {
          'X-API-Key': 'tab_test_12345678901234567890123456789012',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customerName: 'Jane Doe',
          customerEmail: 'invalid-email'
        })
      })

      await expect(POST(request)).rejects.toThrow('Invalid request data')
    })

    it('should default currency to USD', async () => {
      const newTabMock = {
        ...mockTab,
        id: 'tab_new',
        currency: 'USD'
      }
      
      // Mock transaction with nested queries
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockTrx = {
          insert: jest.fn().mockReturnValue({
            values: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([newTabMock])
            })
          }),
          query: {
            tabs: {
              findFirst: jest.fn().mockResolvedValue({
                ...newTabMock,
                lineItems: []
              })
            }
          }
        }
        return callback(mockTrx)
      })

      const request = new NextRequest('http://localhost/api/v1/tabs', {
        method: 'POST',
        headers: {
          'X-API-Key': 'tab_test_12345678901234567890123456789012',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customerName: 'Jane Doe',
          customerEmail: 'jane@example.com',
          lineItems: [{
            description: 'Test Item',
            quantity: 1,
            unitPrice: 5.00
          }]
          // No currency specified - should default to USD
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.tab.currency).toBe('USD')
    })
  })

  describe('GET - Get Single Tab', () => {
    it('should return tab with line items', async () => {
      mockDb.query.tabs.findFirst.mockResolvedValue({
        ...mockTab,
        lineItems: mockLineItems
      })

      const response = await getTab(
        new NextRequest('http://localhost/api/v1/tabs/tab_123', {
          headers: { 'X-API-Key': 'tab_test_12345678901234567890123456789012' }
        }),
        { params: { id: 'tab_123' } }
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toMatchObject({
        id: 'tab_123',
        customerName: 'John Doe'
      })
      expect(data.data.lineItems).toHaveLength(1)
      expect(data.data.lineItems[0].description).toBe('Coffee')
    })

    it('should return 404 for non-existent tab', async () => {
      mockDb.query.tabs.findFirst.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/v1/tabs/non_existent', {
        headers: { 'X-API-Key': 'tab_test_12345678901234567890123456789012' }
      })

      await expect(
        getTab(request, { params: Promise.resolve({ id: 'non_existent' }) })
      ).rejects.toThrow('Tab not found')
    })
  })

  describe('PUT - Update Tab', () => {
    it('should update tab successfully', async () => {
      mockDb.query.tabs.findFirst
        .mockResolvedValueOnce(mockTab) // First call for existing tab check
        .mockResolvedValueOnce({ // Second call for complete tab fetch
          ...mockTab,
          customerName: 'Jane Updated',
          updatedAt: new Date(),
          lineItems: mockLineItems
        })
      
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{
              ...mockTab,
              customerName: 'Jane Updated',
              updatedAt: new Date()
            }])
          })
        })
      })

      const response = await updateTab(
        new NextRequest('http://localhost/api/v1/tabs/tab_123', {
          method: 'PUT',
          headers: {
            'X-API-Key': 'tab_test_12345678901234567890123456789012',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customerName: 'Jane Updated'
          })
        }),
        { params: Promise.resolve({ id: 'tab_123' }) }
      )
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.customerName).toBe('Jane Updated')
    })

    it('should not allow updating paid tabs', async () => {
      mockDb.query.tabs.findFirst.mockResolvedValue({
        ...mockTab,
        status: 'paid'
      })

      await expect(updateTab(
        new NextRequest('http://localhost/api/v1/tabs/tab_123', {
          method: 'PUT',
          headers: {
            'X-API-Key': 'tab_test_12345678901234567890123456789012',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customerName: 'Updated Name'
          })
        }),
        { params: Promise.resolve({ id: 'tab_123' }) }
      )).rejects.toThrow('Cannot update a paid tab')
    })
  })

  describe('DELETE - Delete Tab', () => {
    it('should delete open tab successfully', async () => {
      mockDb.query.tabs.findFirst.mockResolvedValue(mockTab)
      mockDb.delete.mockReturnValue({
        where: jest.fn().mockResolvedValue({ success: true })
      })

      const response = await deleteTab(
        new NextRequest('http://localhost/api/v1/tabs/tab_123', {
          method: 'DELETE',
          headers: {
            'X-API-Key': 'tab_test_12345678901234567890123456789012'
          }
        }),
        { params: { id: 'tab_123' } }
      )

      expect(response.status).toBe(200)
    })

    it('should not allow deleting paid tabs', async () => {
      mockDb.query.tabs.findFirst.mockResolvedValue({
        ...mockTab,
        paidAmount: '100.00', // Has payments, can't delete
        status: 'paid'
      })

      await expect(deleteTab(
        new NextRequest('http://localhost/api/v1/tabs/tab_123', {
          method: 'DELETE',
          headers: {
            'X-API-Key': 'tab_test_12345678901234567890123456789012'
          }
        }),
        { params: { id: 'tab_123' } }
      )).rejects.toThrow('Cannot delete tab with payments')
    })

    it('should return 404 for non-existent tab', async () => {
      mockDb.query.tabs.findFirst.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/v1/tabs/non_existent', {
        method: 'DELETE',
        headers: {
          'X-API-Key': 'tab_test_12345678901234567890123456789012'
        }
      })

      await expect(
        deleteTab(request, { params: Promise.resolve({ id: 'non_existent' }) })
      ).rejects.toThrow('Tab not found')
    })
  })
})