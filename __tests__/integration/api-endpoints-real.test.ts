/**
 * Real API Endpoints Integration Tests
 * Tests actual API routes to catch issues before deployment
 */

import { NextRequest } from 'next/server'

// Test environment setup
process.env.NODE_ENV = 'test'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
process.env.STRIPE_SECRET_KEY = 'sk_test_123'
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
process.env.RESEND_API_KEY = 're_test_123456789'

// Mock external dependencies that we don't want to hit in tests
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-123' } }
      })
    }
  }))
}))

jest.mock('@/lib/stripe/client', () => ({
  stripe: {
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({ 
          id: 'cs_test_123', 
          url: 'https://checkout.stripe.com/test' 
        })
      }
    }
  }
}))

jest.mock('@/lib/redis/client', () => ({
  redis: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    hget: jest.fn().mockResolvedValue(null),
    hset: jest.fn().mockResolvedValue(1),
  }
}))

// Mock database with more realistic responses
jest.mock('@/lib/db/client', () => ({
  db: {
    query: {
      tabs: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null)
      },
      lineItems: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null)
      },
      payments: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null)
      },
      invoices: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null)
      },
      organizations: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'test-org-123',
          name: 'Test Organization',
          isMerchant: true,
          isCorporate: false
        })
      },
      apiKeys: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'key-123',
          organizationId: 'test-org-123',
          hashedKey: 'hashed-key',
          isActive: true
        })
      },
      billingGroups: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null)
      }
    },
    insert: jest.fn(() => ({
      values: jest.fn(() => ({
        returning: jest.fn().mockResolvedValue([{ 
          id: 'new-record-123',
          createdAt: new Date(),
          updatedAt: new Date()
        }])
      }))
    })),
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          execute: jest.fn().mockResolvedValue([{ count: '0' }])
        }))
      }))
    }))
  }
}))

// Mock middleware to always authenticate
jest.mock('@/lib/api/organization-middleware', () => ({
  withOrganizationAuth: jest.fn((handler, options) => {
    return async (request: NextRequest, context?: any) => {
      const mockContext = {
        organizationId: 'test-org-123',
        organization: {
          id: 'test-org-123', 
          name: 'Test Organization',
          isMerchant: true,
          isCorporate: false
        },
        userId: 'test-user-123',
        userRole: 'owner',
        apiKey: 'tab_test_12345678901234567890123456789012',
        authType: 'apiKey' as const,
        scope: 'merchant' as const
      }
      
      return handler(request, mockContext)
    }
  })
}))

describe('API Endpoints Integration Tests', () => {
  describe('Tabs API (/api/v1/tabs)', () => {
    it('should handle GET /api/v1/tabs without errors', async () => {
      // Import the actual route handlers
      const { GET } = await import('@/app/api/v1/tabs/route')
      
      const request = new NextRequest('http://localhost:3000/api/v1/tabs', {
        headers: {
          'x-api-key': 'tab_test_12345678901234567890123456789012'
        }
      })

      // Execute the handler - should not throw
      const response = await GET(request)
      
      // Response should be defined and have proper status
      expect(response).toBeDefined()
      expect(response.status).toBe(200) // Expected success for empty list
      
      // Try to parse response
      const data = await response.json()

      // Should have proper API response structure
      expect(data).toHaveProperty('data')
      console.log('✅ GET /api/v1/tabs works:', data)
    })

    it('should handle POST /api/v1/tabs without errors', async () => {
      const { POST } = await import('@/app/api/v1/tabs/route')
      
      const tabData = {
        customerName: 'Test Customer',
        customerEmail: 'test@example.com',
        currency: 'usd',
        lineItems: [
          {
            description: 'Test Item',
            quantity: 1,
            unitPrice: 25.00
          }
        ]
      }

      const request = new NextRequest('http://localhost:3000/api/v1/tabs', {
        method: 'POST',
        headers: {
          'x-api-key': 'tab_test_12345678901234567890123456789012',
          'content-type': 'application/json'
        },
        body: JSON.stringify(tabData)
      })

      let response: Response
      let error: any = null

      try {
        response = await POST(request)
      } catch (e) {
        error = e
        console.error('POST /api/v1/tabs failed:', e)
      }

      expect(error).toBeNull()
      if (error || !response) return

      expect(response.status).toBeLessThan(500)
      
      let data: any
      try {
        data = await response.json()
      } catch (e) {
        console.error('Response parsing failed:', e)
        throw new Error('API returned invalid JSON')
      }

      console.log('✅ POST /api/v1/tabs works:', data)
    })

    it('should handle GET /api/v1/tabs/[id] without errors', async () => {
      // Mock that a tab exists
      const mockDb = require('@/lib/db/client').db
      mockDb.query.tabs.findFirst.mockResolvedValueOnce({
        id: 'tab-123',
        organizationId: 'test-org-123',
        customerName: 'Test Customer',
        customerEmail: 'test@example.com',
        totalAmount: '100.00',
        paidAmount: '0.00',
        status: 'open',
        currency: 'usd',
        lineItems: [],
        payments: [],
        invoices: []
      })

      const { GET } = await import('@/app/api/v1/tabs/[id]/route')
      
      const request = new NextRequest('http://localhost:3000/api/v1/tabs/tab-123', {
        headers: {
          'x-api-key': 'tab_test_12345678901234567890123456789012'
        }
      })

      let response: Response
      let error: any = null

      try {
        response = await GET(request, { 
          params: Promise.resolve({ id: 'tab-123' }) 
        })
      } catch (e) {
        error = e
        console.error('GET /api/v1/tabs/[id] failed:', e)
      }

      expect(error).toBeNull()
      if (error || !response) return

      expect(response.status).toBeLessThan(500)
      
      let data: any
      try {
        data = await response.json()
      } catch (e) {
        console.error('Response parsing failed:', e)
        throw new Error('API returned invalid JSON')
      }

      console.log('✅ GET /api/v1/tabs/[id] works:', data)
    })
  })

  describe('Payments API (/api/v1/payments)', () => {
    it('should handle GET /api/v1/payments without errors', async () => {
      const { GET } = await import('@/app/api/v1/payments/route')
      
      const request = new NextRequest('http://localhost:3000/api/v1/payments', {
        headers: {
          'x-api-key': 'tab_test_12345678901234567890123456789012'
        }
      })

      let response: Response
      let error: any = null

      try {
        response = await GET(request)
      } catch (e) {
        error = e
        console.error('GET /api/v1/payments failed:', e)
      }

      expect(error).toBeNull()
      if (error || !response) return

      expect(response.status).toBeLessThan(500)
      
      let data: any
      try {
        data = await response.json()
      } catch (e) {
        console.error('Response parsing failed:', e)
        throw new Error('API returned invalid JSON')
      }

      console.log('✅ GET /api/v1/payments works:', data)
    })
  })

  describe('Invoices API (/api/v1/invoices)', () => {
    it('should handle GET /api/v1/invoices without errors', async () => {
      const { GET } = await import('@/app/api/v1/invoices/route')
      
      const request = new NextRequest('http://localhost:3000/api/v1/invoices', {
        headers: {
          'x-api-key': 'tab_test_12345678901234567890123456789012'
        }
      })

      let response: Response
      let error: any = null

      try {
        response = await GET(request)
      } catch (e) {
        error = e
        console.error('GET /api/v1/invoices failed:', e)
      }

      expect(error).toBeNull()
      if (error || !response) return

      expect(response.status).toBeLessThan(500)
      
      let data: any
      try {
        data = await response.json()
      } catch (e) {
        console.error('Response parsing failed:', e)
        throw new Error('API returned invalid JSON')
      }

      console.log('✅ GET /api/v1/invoices works:', data)
    })
  })

  describe('DI Container Health Check', () => {
    it('should be able to create DI services without errors', async () => {
      let error: any = null
      
      try {
        const { getServerDI } = await import('@/lib/di/server')
        const di = getServerDI()
        
        // Try to resolve all services
        const tabService = di.tabService
        const paymentService = di.paymentService
        const invoiceService = di.invoiceService
        const organizationService = di.organizationService
        const billingGroupService = di.billingGroupService
        
        expect(tabService).toBeDefined()
        expect(paymentService).toBeDefined()
        expect(invoiceService).toBeDefined()
        expect(organizationService).toBeDefined()
        expect(billingGroupService).toBeDefined()
        
        console.log('✅ All DI services resolve successfully')
      } catch (e) {
        error = e
        console.error('DI container failed:', e)
      }

      expect(error).toBeNull()
    })
  })

  describe('Middleware Integration', () => {
    it('should handle authentication middleware without errors', async () => {
      let error: any = null
      
      try {
        const { withMerchantDI } = await import('@/lib/api/di-middleware')
        
        const testHandler = withMerchantDI(async (context) => {
          return { organizationId: context.organizationId }
        })
        
        const request = new NextRequest('http://localhost:3000/test', {
          headers: {
            'x-api-key': 'tab_test_12345678901234567890123456789012'
          }
        })
        
        const result = await testHandler(request)
        expect(result).toBeDefined()
        
        console.log('✅ DI middleware works correctly')
      } catch (e) {
        error = e
        console.error('Middleware failed:', e)
      }

      expect(error).toBeNull()
    })
  })
})