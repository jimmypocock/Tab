/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

// Mock all dependencies before importing the route handlers
const mockDb = {
  select: jest.fn(),
  from: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  transaction: jest.fn(),
  query: {
    tabs: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    lineItems: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    organizations: {
      findFirst: jest.fn()
    }
  }
}

jest.mock('@/lib/db/client', () => ({ db: mockDb }))

jest.mock('@/lib/api/organization-middleware', () => ({
  withOrganizationAuth: (handler: any) => {
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
  }
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

// Now import the route handlers
import { GET, POST } from '@/app/api/v1/tabs/route'
import { GET as getTab, PUT as updateTab, DELETE as deleteTab } from '@/app/api/v1/tabs/[id]/route'

describe('Tab API - Simple Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup default mock responses
    const mockChain = {
      where: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      and: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue([]),
      returning: jest.fn().mockResolvedValue([])
    }
    
    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue(mockChain)
    })
    
    mockDb.insert.mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([])
      })
    })
    
    mockDb.update.mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([])
        })
      })
    })
    
    mockDb.delete.mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([])
      })
    })
    
    mockDb.transaction.mockImplementation((cb) => cb(mockDb))
  })

  describe('GET /api/v1/tabs', () => {
    it('should return paginated tabs', async () => {
      const mockTabs = [
        {
          id: 'tab_1',
          organizationId: 'org_123',
          status: 'open',
          customerName: 'John Doe',
          totalAmount: '100.00',
          createdAt: new Date()
        }
      ]
      
      mockDb.select().from().execute.mockResolvedValueOnce(mockTabs)
      
      const request = new NextRequest('http://localhost:3000/api/v1/tabs', {
        headers: { 'x-api-key': 'test_key' }
      })
      
      const response = await GET(request)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      
      expect(data).toHaveProperty('data')
      expect(data).toHaveProperty('pagination')
      expect(data.data).toHaveLength(1)
      expect(data.data[0].id).toBe('tab_1')
    })

    it('should require authentication', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/tabs')
      const response = await GET(request)
      
      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toContain('Authentication required')
    })

    it('should handle pagination parameters', async () => {
      mockDb.select().from().execute.mockResolvedValueOnce([])
      
      const request = new NextRequest('http://localhost:3000/api/v1/tabs?page=2&pageSize=50', {
        headers: { 'x-api-key': 'test_key' }
      })
      
      const response = await GET(request)
      
      expect(response.status).toBe(200)
      const data = await response.json()
      
      expect(data.pagination.page).toBe(2)
      expect(data.pagination.pageSize).toBe(50)
    })
  })

  describe('POST /api/v1/tabs', () => {
    it('should create a new tab', async () => {
      const mockTab = {
        id: 'tab_new',
        organizationId: 'org_123',
        status: 'open',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        totalAmount: '100.00'
      }
      
      mockDb.insert().values().returning.mockResolvedValueOnce([mockTab])
      mockDb.query.tabs.findFirst.mockResolvedValueOnce(mockTab)
      
      const request = new NextRequest('http://localhost:3000/api/v1/tabs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': 'test_key'
        },
        body: JSON.stringify({
          customerName: 'John Doe',
          customerEmail: 'john@example.com',
          currency: 'USD',
          lineItems: [{
            description: 'Test Item',
            quantity: 1,
            unitPrice: 100
          }]
        })
      })
      
      const response = await POST(request)
      
      expect(response.status).toBe(201)
      const data = await response.json()
      
      expect(data.id).toBe('tab_new')
      expect(data.customerName).toBe('John Doe')
    })

    it('should validate required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/tabs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': 'test_key'
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
      const mockTab = {
        id: 'tab_123',
        organizationId: 'org_123',
        status: 'open',
        customerName: 'John Doe',
        lineItems: []
      }
      
      mockDb.query.tabs.findFirst.mockResolvedValueOnce(mockTab)
      
      const request = new NextRequest('http://localhost:3000/api/v1/tabs/tab_123', {
        headers: { 'x-api-key': 'test_key' }
      })
      
      const response = await getTab(request, { params: { id: 'tab_123' } })
      
      expect(response.status).toBe(200)
      const data = await response.json()
      
      expect(data.id).toBe('tab_123')
      expect(data.customerName).toBe('John Doe')
    })

    it('should return 404 for non-existent tab', async () => {
      mockDb.query.tabs.findFirst.mockResolvedValueOnce(null)
      
      const request = new NextRequest('http://localhost:3000/api/v1/tabs/invalid', {
        headers: { 'x-api-key': 'test_key' }
      })
      
      const response = await getTab(request, { params: { id: 'invalid' } })
      
      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toContain('not found')
    })
  })

  describe('PUT /api/v1/tabs/[id]', () => {
    it('should update a tab', async () => {
      const mockTab = {
        id: 'tab_123',
        organizationId: 'org_123',
        status: 'open',
        customerName: 'John Doe'
      }
      
      mockDb.query.tabs.findFirst.mockResolvedValueOnce(mockTab)
      mockDb.update().set().where().returning.mockResolvedValueOnce([{
        ...mockTab,
        customerName: 'Jane Doe'
      }])
      
      const request = new NextRequest('http://localhost:3000/api/v1/tabs/tab_123', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'x-api-key': 'test_key'
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
      const mockTab = {
        id: 'tab_123',
        organizationId: 'org_123',
        status: 'closed',
        customerName: 'John Doe'
      }
      
      mockDb.query.tabs.findFirst.mockResolvedValueOnce(mockTab)
      
      const request = new NextRequest('http://localhost:3000/api/v1/tabs/tab_123', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'x-api-key': 'test_key'
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
      const mockTab = {
        id: 'tab_123',
        organizationId: 'org_123',
        status: 'open',
        paidAmount: '0.00'
      }
      
      mockDb.query.tabs.findFirst.mockResolvedValueOnce(mockTab)
      mockDb.delete().where().returning.mockResolvedValueOnce([mockTab])
      
      const request = new NextRequest('http://localhost:3000/api/v1/tabs/tab_123', {
        method: 'DELETE',
        headers: { 'x-api-key': 'test_key' }
      })
      
      const response = await deleteTab(request, { params: { id: 'tab_123' } })
      
      expect(response.status).toBe(204)
    })

    it('should not delete tabs with payments', async () => {
      const mockTab = {
        id: 'tab_123',
        organizationId: 'org_123',
        status: 'open',
        paidAmount: '50.00',
        payments: [{ id: 'payment_1' }]
      }
      
      mockDb.query.tabs.findFirst.mockResolvedValueOnce(mockTab)
      
      const request = new NextRequest('http://localhost:3000/api/v1/tabs/tab_123', {
        method: 'DELETE',
        headers: { 'x-api-key': 'test_key' }
      })
      
      const response = await deleteTab(request, { params: { id: 'tab_123' } })
      
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('payments')
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors', async () => {
      mockDb.select.mockImplementationOnce(() => {
        throw new Error('Database connection failed')
      })
      
      const request = new NextRequest('http://localhost:3000/api/v1/tabs', {
        headers: { 'x-api-key': 'test_key' }
      })
      
      const response = await GET(request)
      
      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it('should handle invalid JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/tabs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': 'test_key'
        },
        body: '{ invalid json'
      })
      
      const response = await POST(request)
      
      expect(response.status).toBe(400)
    })
  })
})