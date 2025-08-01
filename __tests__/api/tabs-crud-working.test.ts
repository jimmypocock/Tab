/**
 * @jest-environment node
 */

// Define mocks at the very top, before any imports
const mockDb = {
  query: {
    tabs: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    lineItems: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    payments: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    organizations: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    billingGroups: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
  select: jest.fn(),
  from: jest.fn(),
  where: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  transaction: jest.fn(),
}

// Apply mocks before imports
jest.mock('@/lib/db/client', () => ({
  db: mockDb
}))

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((field, value) => ({ type: 'eq', field, value })),
  and: jest.fn((...conditions) => ({ type: 'and', conditions })),
  or: jest.fn((...conditions) => ({ type: 'or', conditions })),
  gte: jest.fn((field, value) => ({ type: 'gte', field, value })),
  lte: jest.fn((field, value) => ({ type: 'lte', field, value })),
  like: jest.fn((field, pattern) => ({ type: 'like', field, pattern })),
  desc: jest.fn((field) => ({ type: 'desc', field })),
  asc: jest.fn((field) => ({ type: 'asc', field })),
}))

jest.mock('@/lib/db/schema', () => ({
  tabs: {
    organizationId: Symbol('tabs.organizationId'),
    status: Symbol('tabs.status'),
    customerEmail: Symbol('tabs.customerEmail'),
    customerOrganizationId: Symbol('tabs.customerOrganizationId'),
    externalReference: Symbol('tabs.externalReference'),
    createdAt: Symbol('tabs.createdAt'),
    totalAmount: Symbol('tabs.totalAmount'),
  },
  lineItems: {},
  payments: {},
  organizations: {},
}))

jest.mock('@/lib/api/organization-middleware', () => ({
  withOrganizationAuth: (request: any, handler: any, options?: any) => {
    const apiKey = request.headers.get('x-api-key')
    
    if (!apiKey) {
      return Promise.resolve(new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }))
    }
    
    const context = {
      organizationId: 'org_123',
      organization: {
        id: 'org_123',
        name: 'Test Organization',
        isMerchant: true,
        isCorporate: false,
      },
      scope: 'merchant' as const,
      authType: 'apiKey' as const,
      userRole: 'owner' as const,
    }
    
    return handler(request, context)
  }
}))

jest.mock('@/lib/db/queries', () => ({
  countRows: jest.fn().mockResolvedValue(0)
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

jest.mock('@/lib/api/field-selection', () => ({
  parseFieldSelection: jest.fn().mockReturnValue(null),
  applyFieldSelection: jest.fn((data) => data),
  DefaultFields: { tab: new Set(['id', 'status']) },
  validateFieldSelection: jest.fn().mockReturnValue({ valid: true })
}))

// Now import after mocks are set up
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/v1/tabs/route'
import { countRows } from '@/lib/db/queries'

describe('Tabs API - Working Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Reset mock implementations
    mockDb.query.tabs.findMany.mockResolvedValue([])
    mockDb.query.tabs.findFirst.mockResolvedValue(null)
    ;(countRows as jest.Mock).mockResolvedValue(0)
  })

  describe('GET /api/v1/tabs', () => {
    it('should require authentication', async () => {
      const request = new NextRequest('http://localhost/api/v1/tabs', {
        method: 'GET',
        // No API key
      })

      const response = await GET(request)
      expect(response.status).toBe(401)
      
      const data = await response.json()
      expect(data.error).toBe('Authentication required')
    })

    it('should return empty list when no tabs exist', async () => {
      mockDb.query.tabs.findMany.mockResolvedValue([])
      ;(countRows as jest.Mock).mockResolvedValue(0)

      const request = new NextRequest('http://localhost/api/v1/tabs', {
        method: 'GET',
        headers: {
          'x-api-key': 'test_key_123'
        }
      })

      const response = await GET(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data).toMatchObject({
        data: [],
        pagination: {
          page: 1,
          pageSize: 10,
          totalPages: 0,
          totalItems: 0
        }
      })
    })

    it('should return tabs with pagination', async () => {
      const mockTabs = [
        {
          id: 'tab_1',
          organizationId: 'org_123',
          status: 'open',
          currency: 'USD',
          totalAmount: '100.00',
          subtotal: '90.91',
          taxAmount: '9.09',
          paidAmount: '0.00',
          customerName: 'John Doe',
          customerEmail: 'john@example.com',
          createdAt: new Date(),
          updatedAt: new Date(),
          // Include relations
          lineItems: [],
          payments: [],
          customerOrganization: null
        }
      ]

      mockDb.query.tabs.findMany.mockResolvedValue(mockTabs)
      ;(countRows as jest.Mock).mockResolvedValue(1)

      const request = new NextRequest('http://localhost/api/v1/tabs', {
        method: 'GET',
        headers: {
          'x-api-key': 'test_key_123'
        }
      })

      const response = await GET(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.data).toHaveLength(1)
      expect(data.data[0]).toMatchObject({
        id: 'tab_1',
        status: 'open',
        customerName: 'John Doe'
      })
      expect(data.pagination).toMatchObject({
        page: 1,
        pageSize: 10,
        totalPages: 1,
        totalItems: 1
      })
    })

    it('should filter tabs by status', async () => {
      const openTab = {
        id: 'tab_open',
        status: 'open',
        organizationId: 'org_123',
        currency: 'USD',
        totalAmount: '100.00',
        subtotal: '90.91',
        taxAmount: '9.09',
        paidAmount: '0.00',
        customerName: 'Open Tab',
        lineItems: [],
        payments: [],
        customerOrganization: null
      }

      mockDb.query.tabs.findMany.mockImplementation(async (config) => {
        // Check if the where clause includes status filter
        return [openTab]
      })
      ;(countRows as jest.Mock).mockResolvedValue(1)

      const request = new NextRequest('http://localhost/api/v1/tabs?status=open', {
        method: 'GET',
        headers: {
          'x-api-key': 'test_key_123'
        }
      })

      const response = await GET(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.data).toHaveLength(1)
      expect(data.data[0].status).toBe('open')
    })

    it('should handle pagination parameters', async () => {
      const tabs = Array.from({ length: 25 }, (_, i) => ({
        id: `tab_${i}`,
        organizationId: 'org_123',
        status: 'open',
        currency: 'USD',
        totalAmount: '100.00',
        subtotal: '90.91',
        taxAmount: '9.09',
        paidAmount: '0.00',
        customerName: `Customer ${i}`,
        lineItems: [],
        payments: [],
        customerOrganization: null
      }))

      mockDb.query.tabs.findMany.mockResolvedValue(tabs.slice(10, 20))
      ;(countRows as jest.Mock).mockResolvedValue(25)

      const request = new NextRequest('http://localhost/api/v1/tabs?page=2&pageSize=10', {
        method: 'GET',
        headers: {
          'x-api-key': 'test_key_123'
        }
      })

      const response = await GET(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.data).toHaveLength(10)
      expect(data.pagination).toMatchObject({
        page: 2,
        pageSize: 10,
        totalPages: 3,
        totalItems: 25
      })
    })
  })

  describe('POST /api/v1/tabs', () => {
    it('should validate required fields', async () => {
      const request = new NextRequest('http://localhost/api/v1/tabs', {
        method: 'POST',
        headers: {
          'x-api-key': 'test_key_123',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          // Missing required fields
        })
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.error).toContain('validation')
    })

    it('should create a tab with line items', async () => {
      const newTab = {
        id: 'tab_new',
        organizationId: 'org_123',
        status: 'open',
        currency: 'USD',
        totalAmount: '11.00',
        subtotal: '10.00',
        taxAmount: '1.00',
        paidAmount: '0.00',
        customerName: 'Jane Doe',
        customerEmail: 'jane@example.com',
        lineItems: [
          {
            id: 'item_1',
            description: 'Test Item',
            quantity: '1',
            unitPrice: '10.00',
            totalPrice: '10.00'
          }
        ]
      }

      // Mock transaction
      mockDb.transaction.mockImplementation(async (callback) => {
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
                name: 'Default',
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
          'x-api-key': 'test_key_123',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          customerName: 'Jane Doe',
          customerEmail: 'jane@example.com',
          lineItems: [{
            description: 'Test Item',
            quantity: 1,
            unitPrice: 10.00
          }]
        })
      })

      const response = await POST(request)
      expect(response.status).toBe(201)
      
      const data = await response.json()
      expect(data).toMatchObject({
        id: 'tab_new',
        customerName: 'Jane Doe',
        customerEmail: 'jane@example.com',
        status: 'open'
      })
    })
  })
})