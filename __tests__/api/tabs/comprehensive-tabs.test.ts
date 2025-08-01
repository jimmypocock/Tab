/**
 * @jest-environment node
 */

// Mock modules before imports
jest.mock('@/lib/db/client')
jest.mock('@/lib/api/organization-middleware')
jest.mock('@/lib/db/queries')
jest.mock('@/lib/services/customer-targeting.service')
jest.mock('@/lib/services/tab-voiding.service')
jest.mock('@/lib/services/billing-group.service')
jest.mock('@/lib/utils/index')

import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/v1/tabs/route'
import { GET as getTab, PUT as updateTab, DELETE as deleteTab } from '@/app/api/v1/tabs/[id]/route'
import { POST as voidTab, PUT as restoreTab, GET as getVoidHistory } from '@/app/api/v1/tabs/[id]/void/route'
import { POST as createQuickSplit } from '@/app/api/v1/tabs/[id]/quick-split/route'
import { POST as enableBillingGroups } from '@/app/api/v1/tabs/[id]/enable-billing-groups/route'
import { GET as getBillingSummary } from '@/app/api/v1/tabs/[id]/billing-summary/route'
import { 
  createAuthenticatedRequest, 
  parseResponse, 
  expectSuccessResponse,
  expectErrorResponse,
  expectPaginatedResponse,
  expectValidationError,
  DEFAULT_MOCK_CONTEXT,
  TestDataFactory
} from '@/__tests__/helpers/api-test-helpers'

// Get mocked modules
import { db } from '@/lib/db/client'
import { withOrganizationAuth } from '@/lib/api/organization-middleware'
import { countRows } from '@/lib/db/queries'
import { CustomerTargetingService } from '@/lib/services/customer-targeting.service'
import { TabVoidingService } from '@/lib/services/tab-voiding.service'
import { BillingGroupService } from '@/lib/services/billing-group.service'
import * as utils from '@/lib/utils/index'

// Type the mocked modules
const mockDb = db as jest.Mocked<typeof db>
const mockWithOrganizationAuth = withOrganizationAuth as jest.MockedFunction<typeof withOrganizationAuth>
const mockCountRows = countRows as jest.MockedFunction<typeof countRows>

// Setup mock implementations
beforeAll(() => {
  // Mock organization middleware
  mockWithOrganizationAuth.mockImplementation((handler: any) => {
    return async (request: NextRequest, context: any) => {
      const apiKey = request.headers.get('x-api-key')
      if (!apiKey) {
        return new Response(JSON.stringify({ error: 'Authentication required' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      return handler(request, DEFAULT_MOCK_CONTEXT, context)
    }
  })

  // Mock count rows
  mockCountRows.mockResolvedValue(10)

  // Mock services
  ;(CustomerTargetingService as any).validateCustomerTargeting = jest.fn().mockReturnValue({ isValid: true })
  
  ;(TabVoidingService as any).validateVoiding = jest.fn().mockResolvedValue({
    canVoid: true,
    hasActiveInvoices: false,
    hasPayments: false
  })
  ;(TabVoidingService as any).voidTab = jest.fn().mockResolvedValue({
    success: true,
    voidedInvoices: [],
    closedBillingGroups: []
  })
  ;(TabVoidingService as any).restoreTab = jest.fn().mockResolvedValue({
    success: true
  })
  ;(TabVoidingService as any).getVoidingHistory = jest.fn().mockResolvedValue([])

  ;(BillingGroupService as any).createDefaultGroup = jest.fn().mockResolvedValue({
    id: 'group_default',
    name: 'Default Group',
    isDefault: true
  })
  ;(BillingGroupService as any).assignLineItemsToDefault = jest.fn().mockResolvedValue({
    updatedCount: 2
  })
  ;(BillingGroupService as any).getBillingSummary = jest.fn().mockResolvedValue({
    groups: [],
    totals: {
      subtotal: '100.00',
      tax: '10.00',
      total: '110.00'
    }
  })

  // Mock utils
  ;(utils as any).TAX_RATE = 0.1
  ;(utils as any).calculateTabBalance = jest.fn().mockReturnValue(0)
  ;(utils as any).getTabStatus = jest.fn().mockReturnValue('open')
  ;(utils as any).PAGINATION_MAX_LIMIT = 100
})

// Helper to setup db mock responses
function setupDbMocks() {
  // Mock query builder pattern
  const mockQueryChain = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    and: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    returning: jest.fn(),
    execute: jest.fn()
  }

  ;(mockDb as any).select = jest.fn().mockReturnValue(mockQueryChain)
  ;(mockDb as any).from = jest.fn().mockReturnValue(mockQueryChain)
  ;(mockDb as any).insert = jest.fn().mockReturnValue({
    values: jest.fn().mockReturnValue({
      returning: jest.fn()
    })
  })
  ;(mockDb as any).update = jest.fn().mockReturnValue({
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        returning: jest.fn()
      })
    })
  })
  ;(mockDb as any).delete = jest.fn().mockReturnValue({
    where: jest.fn().mockReturnValue({
      returning: jest.fn()
    })
  })

  // Mock query object
  ;(mockDb as any).query = {
    tabs: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    lineItems: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    merchants: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    organizations: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    billingGroups: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    }
  }

  // Mock transaction
  ;(mockDb as any).transaction = jest.fn((cb) => cb(mockDb))

  return mockQueryChain
}

describe('Tab API Endpoints - Comprehensive Tests', () => {
  let mockQueryChain: any

  beforeEach(() => {
    jest.clearAllMocks()
    mockQueryChain = setupDbMocks()
  })

  describe('GET /api/v1/tabs', () => {
    const mockTabs = [
      TestDataFactory.tab({ id: 'tab_1' }),
      TestDataFactory.tab({ id: 'tab_2', status: 'closed' })
    ]

    beforeEach(() => {
      mockQueryChain.execute.mockResolvedValue(mockTabs)
      mockQueryChain.returning.mockResolvedValue(mockTabs)
    })

    it('should return paginated tabs with authentication', async () => {
      const request = createAuthenticatedRequest('GET', '/api/v1/tabs')
      const response = await GET(request)
      
      expectSuccessResponse(response)
      const data = await parseResponse(response)
      
      expectPaginatedResponse(data)
      expect(data.data).toHaveLength(2)
      expect(data.data[0].id).toBe('tab_1')
    })

    it('should handle pagination parameters', async () => {
      const request = createAuthenticatedRequest('GET', '/api/v1/tabs', {
        searchParams: { page: '2', pageSize: '50' }
      })
      
      const response = await GET(request)
      expectSuccessResponse(response)
      
      const data = await parseResponse(response)
      expect(data.pagination.page).toBe(2)
      expect(data.pagination.pageSize).toBe(50)
    })

    it('should filter by status', async () => {
      const request = createAuthenticatedRequest('GET', '/api/v1/tabs', {
        searchParams: { status: 'open' }
      })
      
      const response = await GET(request)
      expectSuccessResponse(response)
      
      expect(mockDb.select).toHaveBeenCalled()
    })

    it('should filter by customer', async () => {
      const request = createAuthenticatedRequest('GET', '/api/v1/tabs', {
        searchParams: { 
          customerEmail: 'john@example.com',
          customerName: 'John Doe'
        }
      })
      
      const response = await GET(request)
      expectSuccessResponse(response)
    })

    it('should handle date range filters', async () => {
      const request = createAuthenticatedRequest('GET', '/api/v1/tabs', {
        searchParams: {
          startDate: '2023-01-01',
          endDate: '2023-12-31'
        }
      })
      
      const response = await GET(request)
      expectSuccessResponse(response)
    })

    it('should return 401 without authentication', async () => {
      const request = createAuthenticatedRequest('GET', '/api/v1/tabs', {
        headers: { 'x-api-key': '' }
      })
      
      const response = await GET(request)
      await expectErrorResponse(response, 401, 'Authentication required')
    })

    it('should handle invalid pagination parameters', async () => {
      const request = createAuthenticatedRequest('GET', '/api/v1/tabs', {
        searchParams: { page: '-1', pageSize: '1000' }
      })
      
      const response = await GET(request)
      expectSuccessResponse(response)
      
      const data = await parseResponse(response)
      expect(data.pagination.page).toBe(1)
      expect(data.pagination.pageSize).toBeLessThanOrEqual(100)
    })
  })

  describe('POST /api/v1/tabs', () => {
    const validTabData = {
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      currency: 'USD',
      lineItems: [
        {
          description: 'Product 1',
          quantity: 2,
          unitPrice: 25.00
        },
        {
          description: 'Service 1',
          quantity: 1,
          unitPrice: 50.00
        }
      ]
    }

    beforeEach(() => {
      const mockTab = TestDataFactory.tab({ id: 'tab_new' })
      ;(mockDb.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockTab])
        })
      })
      ;(mockDb.query.tabs.findFirst as jest.Mock).mockResolvedValue(mockTab)
    })

    it('should create a tab with line items', async () => {
      const request = createAuthenticatedRequest('POST', '/api/v1/tabs', {
        body: validTabData
      })
      
      const response = await POST(request)
      expectSuccessResponse(response, 201)
      
      const data = await parseResponse(response)
      expect(data.id).toBe('tab_new')
      expect(data.customerName).toBe('John Doe')
      expect(data.totalAmount).toBeDefined()
    })

    it('should validate required fields', async () => {
      const request = createAuthenticatedRequest('POST', '/api/v1/tabs', {
        body: { customerName: 'John' } // Missing required fields
      })
      
      const response = await POST(request)
      await expectValidationError(response)
    })

    it('should validate email format', async () => {
      const request = createAuthenticatedRequest('POST', '/api/v1/tabs', {
        body: {
          ...validTabData,
          customerEmail: 'invalid-email'
        }
      })
      
      const response = await POST(request)
      await expectValidationError(response, 'email')
    })

    it('should validate line items', async () => {
      const request = createAuthenticatedRequest('POST', '/api/v1/tabs', {
        body: {
          ...validTabData,
          lineItems: [
            {
              description: 'Invalid item',
              quantity: -1, // Invalid quantity
              unitPrice: 10
            }
          ]
        }
      })
      
      const response = await POST(request)
      await expectValidationError(response)
    })

    it('should handle customer organization targeting', async () => {
      const request = createAuthenticatedRequest('POST', '/api/v1/tabs', {
        body: {
          ...validTabData,
          customerOrganizationId: 'org_customer'
        }
      })
      
      const response = await POST(request)
      expectSuccessResponse(response, 201)
    })

    it('should support metadata', async () => {
      const request = createAuthenticatedRequest('POST', '/api/v1/tabs', {
        body: {
          ...validTabData,
          metadata: {
            orderId: '12345',
            source: 'web'
          }
        }
      })
      
      const response = await POST(request)
      expectSuccessResponse(response, 201)
      
      const data = await parseResponse(response)
      expect(data.metadata).toMatchObject({
        orderId: '12345',
        source: 'web'
      })
    })
  })

  describe('GET /api/v1/tabs/[id]', () => {
    const mockTab = TestDataFactory.tab()
    const mockLineItems = [
      TestDataFactory.lineItem({ tabId: mockTab.id }),
      TestDataFactory.lineItem({ tabId: mockTab.id, id: 'item_2' })
    ]

    beforeEach(() => {
      ;(mockDb.query.tabs.findFirst as jest.Mock).mockResolvedValue({
        ...mockTab,
        lineItems: mockLineItems
      })
    })

    it('should retrieve a tab with line items', async () => {
      const request = createAuthenticatedRequest('GET', '/api/v1/tabs/tab_123')
      const response = await getTab(request, { params: { id: 'tab_123' } })
      
      expectSuccessResponse(response)
      const data = await parseResponse(response)
      
      expect(data.id).toBe('tab_123')
      expect(data.lineItems).toHaveLength(2)
    })

    it('should return 404 for non-existent tab', async () => {
      ;(mockDb.query.tabs.findFirst as jest.Mock).mockResolvedValue(null)
      
      const request = createAuthenticatedRequest('GET', '/api/v1/tabs/invalid_id')
      const response = await getTab(request, { params: { id: 'invalid_id' } })
      
      await expectErrorResponse(response, 404, 'Tab not found')
    })

    it('should include payment summary', async () => {
      ;(mockDb.query.tabs.findFirst as jest.Mock).mockResolvedValue({
        ...mockTab,
        lineItems: mockLineItems,
        payments: [TestDataFactory.payment()]
      })
      
      const request = createAuthenticatedRequest('GET', '/api/v1/tabs/tab_123')
      const response = await getTab(request, { params: { id: 'tab_123' } })
      
      expectSuccessResponse(response)
      const data = await parseResponse(response)
      
      expect(data.paymentSummary).toBeDefined()
    })
  })

  describe('PUT /api/v1/tabs/[id]', () => {
    const mockTab = TestDataFactory.tab()

    beforeEach(() => {
      ;(mockDb.query.tabs.findFirst as jest.Mock).mockResolvedValue(mockTab)
      ;(mockDb.update as jest.Mock).mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{ ...mockTab, customerName: 'Jane Doe' }])
          })
        })
      })
    })

    it('should update tab details', async () => {
      const request = createAuthenticatedRequest('PUT', '/api/v1/tabs/tab_123', {
        body: {
          customerName: 'Jane Doe',
          customerEmail: 'jane@example.com'
        }
      })
      
      const response = await updateTab(request, { params: { id: 'tab_123' } })
      expectSuccessResponse(response)
      
      const data = await parseResponse(response)
      expect(data.customerName).toBe('Jane Doe')
    })

    it('should prevent updates to closed tabs', async () => {
      ;(mockDb.query.tabs.findFirst as jest.Mock).mockResolvedValue({
        ...mockTab,
        status: 'closed'
      })
      
      const request = createAuthenticatedRequest('PUT', '/api/v1/tabs/tab_123', {
        body: { customerName: 'Jane Doe' }
      })
      
      const response = await updateTab(request, { params: { id: 'tab_123' } })
      await expectErrorResponse(response, 400, 'Cannot update closed tab')
    })

    it('should validate update data', async () => {
      const request = createAuthenticatedRequest('PUT', '/api/v1/tabs/tab_123', {
        body: {
          customerEmail: 'invalid-email'
        }
      })
      
      const response = await updateTab(request, { params: { id: 'tab_123' } })
      await expectValidationError(response, 'email')
    })
  })

  describe('DELETE /api/v1/tabs/[id]', () => {
    const mockTab = TestDataFactory.tab()

    beforeEach(() => {
      ;(mockDb.query.tabs.findFirst as jest.Mock).mockResolvedValue(mockTab)
      ;(mockDb.delete as jest.Mock).mockReturnValue({
        where: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockTab])
        })
      })
    })

    it('should delete an open tab without payments', async () => {
      const request = createAuthenticatedRequest('DELETE', '/api/v1/tabs/tab_123')
      const response = await deleteTab(request, { params: { id: 'tab_123' } })
      
      expectSuccessResponse(response, 204)
    })

    it('should prevent deletion of tabs with payments', async () => {
      ;(mockDb.query.tabs.findFirst as jest.Mock).mockResolvedValue({
        ...mockTab,
        paidAmount: '50.00',
        payments: [TestDataFactory.payment()]
      })
      
      const request = createAuthenticatedRequest('DELETE', '/api/v1/tabs/tab_123')
      const response = await deleteTab(request, { params: { id: 'tab_123' } })
      
      await expectErrorResponse(response, 400, 'Cannot delete tab with payments')
    })

    it('should handle cascade deletion of line items', async () => {
      const request = createAuthenticatedRequest('DELETE', '/api/v1/tabs/tab_123')
      const response = await deleteTab(request, { params: { id: 'tab_123' } })
      
      expectSuccessResponse(response, 204)
      expect(mockDb.delete).toHaveBeenCalled()
    })
  })

  describe('POST /api/v1/tabs/[id]/void', () => {
    const mockTab = TestDataFactory.tab()

    beforeEach(() => {
      ;(mockDb.query.tabs.findFirst as jest.Mock).mockResolvedValue(mockTab)
    })

    it('should void a tab with reason', async () => {
      const request = createAuthenticatedRequest('POST', '/api/v1/tabs/tab_123/void', {
        body: {
          reason: 'Customer cancelled order',
          voidDraftInvoices: true,
          closeActiveBillingGroups: true
        }
      })
      
      const response = await voidTab(request, { params: { id: 'tab_123' } })
      expectSuccessResponse(response)
      
      const data = await parseResponse(response)
      expect(data.success).toBe(true)
    })

    it('should require void reason', async () => {
      const request = createAuthenticatedRequest('POST', '/api/v1/tabs/tab_123/void', {
        body: {}
      })
      
      const response = await voidTab(request, { params: { id: 'tab_123' } })
      await expectValidationError(response, 'reason')
    })

    it('should prevent voiding tabs with active invoices', async () => {
      ;(TabVoidingService as any).validateVoiding.mockResolvedValueOnce({
        canVoid: false,
        hasActiveInvoices: true,
        hasPayments: false,
        reason: 'Tab has active invoices'
      })
      
      const request = createAuthenticatedRequest('POST', '/api/v1/tabs/tab_123/void', {
        body: { reason: 'Test void' }
      })
      
      const response = await voidTab(request, { params: { id: 'tab_123' } })
      await expectErrorResponse(response, 400)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle database connection errors', async () => {
      ;(mockDb.select as jest.Mock).mockRejectedValueOnce(new Error('Database connection failed'))
      
      const request = createAuthenticatedRequest('GET', '/api/v1/tabs')
      const response = await GET(request)
      
      await expectErrorResponse(response, 500)
    })

    it('should handle malformed JSON in request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/tabs', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': 'tab_test_12345678901234567890123456789012'
        },
        body: '{ invalid json'
      })
      
      const response = await POST(request)
      await expectErrorResponse(response, 400)
    })
  })
})