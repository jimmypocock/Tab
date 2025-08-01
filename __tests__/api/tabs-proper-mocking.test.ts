/**
 * @jest-environment node
 */

// Import test mocks FIRST before any route imports
import { mockDb, mockOrganizationContext, setupDbMocks } from '../setup/test-mocks'

// Mock the organization middleware
jest.mock('@/lib/api/organization-middleware', () => ({
  withOrganizationAuth: jest.fn((request: any, handler: any, options?: any) => {
    const apiKey = request.headers.get('x-api-key')
    
    if (!apiKey) {
      return Promise.resolve(new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }))
    }
    
    return handler(request, mockOrganizationContext)
  })
}))

// Mock other dependencies
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

// Mock drizzle-orm operators
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

// Mock schema
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
  organizations: {}
}))

// NOW import the routes
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/v1/tabs/route'
import { countRows } from '@/lib/db/queries'

describe('Tabs API - Proper Mocking Pattern', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupDbMocks()
    
    // Reset query mocks
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

    it('should return tabs with relations', async () => {
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
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        // Include relations as the API expects
        lineItems: [
          {
            id: 'item_1',
            description: 'Coffee',
            quantity: '2',
            unitPrice: '5.00',
            totalPrice: '10.00'
          }
        ],
        payments: [],
        customerOrganization: null
      }

      mockDb.query.tabs.findMany.mockResolvedValue([mockTab])
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
        id: 'tab_123',
        status: 'open',
        customerName: 'John Doe',
        lineItems: expect.arrayContaining([
          expect.objectContaining({
            description: 'Coffee'
          })
        ])
      })
    })

    it('should handle pagination', async () => {
      const tabs = Array.from({ length: 25 }, (_, i) => ({
        id: `tab_${i}`,
        organizationId: 'org_123',
        status: 'open',
        customerName: `Customer ${i}`,
        totalAmount: '100.00',
        lineItems: [],
        payments: [],
        customerOrganization: null
      }))

      // Mock paginated results
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
      
      // Verify the query was called with correct params
      expect(mockDb.query.tabs.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 10
        })
      )
    })
  })

  describe('POST /api/v1/tabs', () => {
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
        lineItems: [{
          id: 'item_1',
          description: 'Test Item',
          quantity: '1',
          unitPrice: '10.00',
          totalPrice: '10.00'
        }]
      }

      // Mock the transaction
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

    it('should validate required fields', async () => {
      const request = new NextRequest('http://localhost/api/v1/tabs', {
        method: 'POST',
        headers: {
          'x-api-key': 'test_key_123',
          'content-type': 'application/json'
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
  })
})