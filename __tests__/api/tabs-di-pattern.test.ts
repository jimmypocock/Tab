/**
 * Tab API Tests using Dependency Injection Pattern
 */

import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/v1/tabs/route-di'
import { initializeDI, resetDI, getDI, DITokens } from '@/lib/di'
import { TabRepository } from '@/lib/repositories/tab.repository'
import { FeatureFlagService } from '@/lib/services/feature-flag.service'

// Mock the middleware
jest.mock('@/lib/api/organization-middleware', () => ({
  withOrganizationAuth: jest.fn((request: any, handler: any, options?: any) => {
    const apiKey = request.headers.get('x-api-key')
    
    if (!apiKey) {
      return Promise.resolve(new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }))
    }
    
    const mockContext = {
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
    
    return handler(request, mockContext)
  })
}))

describe('Tabs API - DI Pattern', () => {
  let mockTabRepo: jest.Mocked<TabRepository>
  let mockFeatureFlags: jest.Mocked<FeatureFlagService>

  beforeEach(() => {
    // Reset and initialize DI container for tests
    resetDI()
    initializeDI('test')
    
    // Get the test container
    const container = getDI()
    
    // Get mocked services
    const mockDb = container.resolve(DITokens.Database) as any
    mockFeatureFlags = container.resolve(DITokens.FeatureFlags) as any
    
    // Enable DI pattern for these tests
    mockFeatureFlags.isEnabled.mockResolvedValue(true)
    
    // Set up database mocks
    mockDb.query.tabs.findMany.mockResolvedValue([])
    mockDb.query.tabs.findFirst.mockResolvedValue(null)
    mockDb.query.billingGroups.findFirst.mockResolvedValue({
      id: 'default_group',
      name: 'Default',
      isDefault: true
    })
    
    // Mock count query
    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          execute: jest.fn().mockResolvedValue([{ count: 0 }])
        })
      })
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
    resetDI()
  })

  describe('GET /api/v1/tabs', () => {
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
          lineItems: [],
          payments: [],
          customerOrganization: null
        }
      ]

      const container = getDI()
      const mockDb = container.resolve(DITokens.Database) as any
      
      mockDb.query.tabs.findMany.mockResolvedValue(mockTabs)
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            execute: jest.fn().mockResolvedValue([{ count: 1 }])
          })
        })
      })

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
    })

    it('should handle query parameters', async () => {
      const request = new NextRequest('http://localhost/api/v1/tabs?status=open&page=2&limit=20', {
        method: 'GET',
        headers: {
          'x-api-key': 'test_key_123'
        }
      })

      const response = await GET(request)
      expect(response.status).toBe(200)
      
      const container = getDI()
      const mockDb = container.resolve(DITokens.Database) as any
      
      // Verify the repository was called with correct parameters
      expect(mockDb.query.tabs.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 20,
          offset: 20, // page 2 with size 20
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
        lineItems: []
      }

      const container = getDI()
      const mockDb = container.resolve(DITokens.Database) as any
      
      // Mock transaction
      mockDb.transaction.mockImplementation(async (callback: any) => {
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

  describe('Feature Flag Integration', () => {
    it('should fall back to original implementation when DI is disabled', async () => {
      // Disable DI pattern
      mockFeatureFlags.isEnabled.mockResolvedValue(false)
      
      // Mock the original route
      jest.mock('@/app/api/v1/tabs/route', () => ({
        GET: jest.fn().mockResolvedValue(
          new Response(JSON.stringify({ legacy: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        )
      }))

      const request = new NextRequest('http://localhost/api/v1/tabs', {
        method: 'GET',
        headers: {
          'x-api-key': 'test_key_123'
        }
      })

      const response = await GET(request)
      expect(response.status).toBe(200)
      
      // Verify feature flag was checked
      expect(mockFeatureFlags.isEnabled).toHaveBeenCalledWith(
        'use-di-pattern',
        expect.objectContaining({ organizationId: 'org_123' })
      )
    })
  })
})