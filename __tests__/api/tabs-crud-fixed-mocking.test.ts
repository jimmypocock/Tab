/**
 * @jest-environment node
 */

// Create mock database object
const mockDb = {
  // Query builder API mocks
  select: jest.fn(),
  from: jest.fn(),
  where: jest.fn(),
  eq: jest.fn(),
  and: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  offset: jest.fn(),
  innerJoin: jest.fn(),
  insert: jest.fn(),
  values: jest.fn(),
  returning: jest.fn(),
  update: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  execute: jest.fn(),
  transaction: jest.fn(),
  
  // Relational query API
  query: {
    tabs: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    merchants: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    lineItems: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    organizations: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    apiKeys: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    payments: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    billingGroups: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  }
}

// Mock database client FIRST, before imports that use it
jest.mock('@/lib/db/client', () => ({
  db: mockDb
}))

// Mock the middleware - it should call the handler directly in the route
jest.mock('@/lib/api/organization-middleware', () => ({
  withOrganizationAuth: jest.fn((request: NextRequest, handler: any, options?: any) => {
    const apiKey = request.headers.get('x-api-key')
    
    if (!apiKey) {
      return Promise.resolve(new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }))
    }
    
    // Mock organization context
    const mockContext = {
      organizationId: 'org_123',
      organization: {
        id: 'org_123',
        name: 'Test Organization',
        isMerchant: true,
        isCorporate: false,
        merchantId: 'merchant_123'
      },
      scope: 'full',
      authType: 'apiKey',
      user: {
        id: 'user_123',
        email: 'test@example.com'
      },
      userRole: 'owner',
      apiKey: {
        id: 'key_123',
        name: 'Test Key',
        scope: 'full'
      }
    }
    
    // Call the handler directly with the mocked context
    return handler(request, mockContext)
  })
}))

// Mock database schema
jest.mock('@/lib/db/schema', () => ({
  tabs: {
    organizationId: 'tabs.organizationId',
    status: 'tabs.status',
    customerEmail: 'tabs.customerEmail',
    customerOrganizationId: 'tabs.customerOrganizationId',
    externalReference: 'tabs.externalReference',
    createdAt: 'tabs.createdAt',
    totalAmount: 'tabs.totalAmount'
  },
  lineItems: {},
  payments: {},
  organizations: {},
  apiKeys: {},
  billingGroups: {}
}))

// Mock drizzle-orm functions
jest.mock('drizzle-orm', () => ({
  eq: jest.fn((field, value) => ({ field, value, op: 'eq' })),
  and: jest.fn((...conditions) => ({ conditions, op: 'and' })),
  or: jest.fn((...conditions) => ({ conditions, op: 'or' })),
  gte: jest.fn((field, value) => ({ field, value, op: 'gte' })),
  lte: jest.fn((field, value) => ({ field, value, op: 'lte' })),
  like: jest.fn((field, value) => ({ field, value, op: 'like' })),
  desc: jest.fn((field) => ({ field, op: 'desc' })),
  asc: jest.fn((field) => ({ field, op: 'asc' })),
  sql: jest.fn((strings, ...values) => ({ strings, values, op: 'sql' }))
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

import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/v1/tabs/route'
import { GET as getTab, PUT as updateTab, DELETE as deleteTab } from '@/app/api/v1/tabs/[id]/route'
import { db } from '@/lib/db/client'
import { countRows } from '@/lib/db/queries'

describe('/api/v1/tabs - Fixed Mocking', () => {
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
    updatedAt: new Date('2023-01-01'),
    // Include relations
    lineItems: [],
    payments: [],
    customerOrganization: null
  }

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup transaction mock
    (db.transaction as jest.Mock).mockImplementation(async (callback) => {
      const txMock = {
        insert: jest.fn().mockReturnValue({
          values: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([mockTab])
          })
        }),
        query: {
          tabs: {
            findFirst: jest.fn().mockResolvedValue(mockTab)
          }
        }
      }
      return callback(txMock)
    })
  })

  describe('GET - List Tabs', () => {
    it('should return tabs successfully', async () => {
      // Mock the relational query
      mockDb.query.tabs.findMany.mockResolvedValue([mockTab])
      ;(countRows as jest.Mock).mockResolvedValue(1)

      const request = new NextRequest('http://localhost/api/v1/tabs', {
        method: 'GET',
        headers: {
          'X-API-Key': 'tab_test_12345678901234567890123456789012'
        }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('data')
      expect(data).toHaveProperty('pagination')
      expect(Array.isArray(data.data)).toBe(true)
      expect(data.data.length).toBe(1)
      expect(data.data[0]).toMatchObject({
        id: 'tab_123',
        status: 'open',
        totalAmount: '100.00',
        customerName: 'John Doe'
      })
    })

    it('should handle pagination', async () => {
      const tabs = Array.from({ length: 25 }, (_, i) => ({
        ...mockTab,
        id: `tab_${i}`,
        customerName: `Customer ${i}`
      }))
      
      mockDb.query.tabs.findMany.mockResolvedValue(tabs.slice(0, 20))
      ;(countRows as jest.Mock).mockResolvedValue(25)

      const request = new NextRequest('http://localhost/api/v1/tabs?page=1&pageSize=20', {
        method: 'GET',
        headers: {
          'X-API-Key': 'tab_test_12345678901234567890123456789012'
        }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toHaveLength(20)
      expect(data.pagination).toMatchObject({
        page: 1,
        pageSize: 20,
        totalPages: 2,
        totalItems: 25
      })
    })

    it('should filter by status', async () => {
      const openTabs = [{ ...mockTab, status: 'open' }]
      mockDb.query.tabs.findMany.mockResolvedValue(openTabs)
      ;(countRows as jest.Mock).mockResolvedValue(1)

      const request = new NextRequest('http://localhost/api/v1/tabs?status=open', {
        method: 'GET',
        headers: {
          'X-API-Key': 'tab_test_12345678901234567890123456789012'
        }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toHaveLength(1)
      expect(data.data[0].status).toBe('open')
      
      // Verify the query was called with correct parameters
      expect(mockDb.query.tabs.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.any(Function),
          with: expect.objectContaining({
            lineItems: expect.any(Object),
            payments: expect.any(Object),
            customerOrganization: expect.any(Object)
          })
        })
      )
    })

    it('should require authentication', async () => {
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
    it('should create tab with line items', async () => {
      const newTab = {
        ...mockTab,
        id: 'tab_new',
        customerName: 'Jane Doe',
        customerEmail: 'jane@example.com',
        lineItems: [
          {
            id: 'item_1',
            tabId: 'tab_new',
            description: 'Test Item',
            quantity: '1',
            unitPrice: '5.00',
            totalPrice: '5.00'
          }
        ]
      }

      // Mock transaction for creation
      (db.transaction as jest.Mock).mockImplementation(async (callback) => {
        const txMock = {
          insert: jest.fn().mockReturnValue({
            values: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([newTab])
            })
          }),
          query: {
            tabs: {
              findFirst: jest.fn().mockResolvedValue(newTab)
            },
            billingGroups: {
              findFirst: jest.fn().mockResolvedValue({
                id: 'default_group',
                name: 'Default Group',
                isDefault: true
              })
            }
          }
        }
        return callback(txMock)
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
      expect(data).toMatchObject({
        id: 'tab_new',
        customerName: 'Jane Doe',
        customerEmail: 'jane@example.com',
        status: 'open'
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
          // Missing required fields
          currency: 'USD'
        })
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.error).toContain('validation')
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
          customerEmail: 'invalid-email',
          lineItems: [{ description: 'Test', quantity: 1, unitPrice: 10 }]
        })
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.error).toContain('email')
    })
  })

  describe('GET - Get Single Tab', () => {
    it('should return tab with relations', async () => {
      const tabWithRelations = {
        ...mockTab,
        lineItems: [{
          id: 'item_1',
          description: 'Coffee',
          quantity: '2',
          unitPrice: '5.00',
          totalPrice: '10.00'
        }],
        payments: [{
          id: 'payment_1',
          amount: '50.00',
          status: 'succeeded'
        }]
      }

      mockDb.query.tabs.findFirst.mockResolvedValue(tabWithRelations)

      const request = new NextRequest('http://localhost/api/v1/tabs/tab_123', {
        headers: { 'X-API-Key': 'tab_test_12345678901234567890123456789012' }
      })

      const response = await getTab(request, { params: { id: 'tab_123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        id: 'tab_123',
        customerName: 'John Doe',
        lineItems: expect.arrayContaining([
          expect.objectContaining({ description: 'Coffee' })
        ]),
        payments: expect.arrayContaining([
          expect.objectContaining({ status: 'succeeded' })
        ])
      })
    })

    it('should return 404 for non-existent tab', async () => {
      mockDb.query.tabs.findFirst.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/v1/tabs/non_existent', {
        headers: { 'X-API-Key': 'tab_test_12345678901234567890123456789012' }
      })

      const response = await getTab(request, { params: { id: 'non_existent' } })
      expect(response.status).toBe(404)
      
      const data = await response.json()
      expect(data.error).toContain('not found')
    })
  })

  describe('PUT - Update Tab', () => {
    it('should update tab successfully', async () => {
      const updatedTab = {
        ...mockTab,
        customerName: 'Jane Updated',
        updatedAt: new Date()
      }

      mockDb.query.tabs.findFirst
        .mockResolvedValueOnce(mockTab) // First call for existence check
        .mockResolvedValueOnce(updatedTab) // Second call for returning updated tab

      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([updatedTab])
          })
        })
      })

      const request = new NextRequest('http://localhost/api/v1/tabs/tab_123', {
        method: 'PUT',
        headers: {
          'X-API-Key': 'tab_test_12345678901234567890123456789012',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customerName: 'Jane Updated'
        })
      })

      const response = await updateTab(request, { params: { id: 'tab_123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.customerName).toBe('Jane Updated')
    })

    it('should not update closed tabs', async () => {
      const closedTab = { ...mockTab, status: 'closed' }
      mockDb.query.tabs.findFirst.mockResolvedValue(closedTab)

      const request = new NextRequest('http://localhost/api/v1/tabs/tab_123', {
        method: 'PUT',
        headers: {
          'X-API-Key': 'tab_test_12345678901234567890123456789012',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customerName: 'Should Not Update'
        })
      })

      const response = await updateTab(request, { params: { id: 'tab_123' } })
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.error).toContain('closed')
    })
  })

  describe('DELETE - Delete Tab', () => {
    it('should delete open tab without payments', async () => {
      mockDb.query.tabs.findFirst.mockResolvedValue(mockTab)
      mockDb.delete.mockReturnValue({
        where: jest.fn().mockResolvedValue({ success: true })
      })

      const request = new NextRequest('http://localhost/api/v1/tabs/tab_123', {
        method: 'DELETE',
        headers: {
          'X-API-Key': 'tab_test_12345678901234567890123456789012'
        }
      })

      const response = await deleteTab(request, { params: { id: 'tab_123' } })
      expect(response.status).toBe(204)
    })

    it('should not delete tabs with payments', async () => {
      const tabWithPayment = {
        ...mockTab,
        paidAmount: '50.00',
        payments: [{ id: 'payment_1', amount: '50.00' }]
      }
      mockDb.query.tabs.findFirst.mockResolvedValue(tabWithPayment)
      mockDb.query.payments.findMany.mockResolvedValue([{ id: 'payment_1' }])

      const request = new NextRequest('http://localhost/api/v1/tabs/tab_123', {
        method: 'DELETE',
        headers: {
          'X-API-Key': 'tab_test_12345678901234567890123456789012'
        }
      })

      const response = await deleteTab(request, { params: { id: 'tab_123' } })
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.error).toContain('payments')
    })
  })
})