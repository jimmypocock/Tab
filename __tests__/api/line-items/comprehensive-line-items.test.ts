/**
 * @jest-environment node
 */

// Mock modules before imports
jest.mock('@/lib/db/client')
jest.mock('@/lib/api/organization-middleware')
jest.mock('@/lib/db/queries')
jest.mock('@/lib/services/line-item-crud.service')
jest.mock('@/lib/services/billing-group.service')
jest.mock('@/lib/utils/index')

import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/v1/line-items/route'
import { GET as getLineItem, PUT as updateLineItem, DELETE as deleteLineItem } from '@/app/api/v1/line-items/[id]/route'
import { POST as assignLineItem } from '@/app/api/v1/line-items/[id]/assign/route'
import { POST as unassignLineItem } from '@/app/api/v1/line-items/[id]/unassign/route'
import { GET as getProtectionStatus } from '@/app/api/v1/line-items/[id]/protection-status/route'
import { POST as bulkAssign } from '@/app/api/v1/line-items/bulk-assign/route'
import { POST as bulkOperations } from '@/app/api/v1/line-items/bulk-operations/route'
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
import { LineItemCrudService } from '@/lib/services/line-item-crud.service'
import { BillingGroupService } from '@/lib/services/billing-group.service'
import * as utils from '@/lib/utils/index'

// Type the mocked modules
const mockDb = db as jest.Mocked<typeof db>
const mockWithOrganizationAuth = withOrganizationAuth as jest.MockedFunction<typeof withOrganizationAuth>
const mockCountRows = countRows as jest.MockedFunction<typeof countRows>

jest.mock('@/lib/db/queries', () => ({
  countRows: jest.fn().mockResolvedValue(10)
}))

jest.mock('@/lib/services/line-item-crud.service', () => ({
  LineItemCrudService: {
    checkProtectionStatus: jest.fn().mockResolvedValue({
      isProtected: false,
      hasPayments: false,
      isInPaidInvoice: false,
      isInSentInvoice: false
    }),
    updateLineItem: jest.fn(),
    deleteLineItem: jest.fn()
  }
}))

jest.mock('@/lib/services/billing-group.service', () => ({
  BillingGroupService: {
    validateBillingGroup: jest.fn().mockResolvedValue(true),
    assignLineItems: jest.fn().mockResolvedValue({ updated: 1 }),
    unassignLineItems: jest.fn().mockResolvedValue({ updated: 1 })
  }
}))

jest.mock('@/lib/utils/index', () => ({
  TAX_RATE: 0.1,
  calculateLineItemTotal: jest.fn((quantity, unitPrice) => quantity * unitPrice),
  PAGINATION_MAX_LIMIT: 100
}))

describe('Line Item API Endpoints - Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/v1/line-items', () => {
    const mockLineItems = [
      TestDataFactory.lineItem({ id: 'item_1' }),
      TestDataFactory.lineItem({ id: 'item_2', billingGroupId: 'group_123' })
    ]

    beforeEach(() => {
      mockDbResponse(mockDb, 'select', mockLineItems)
    })

    it('should return paginated line items with authentication', async () => {
      const request = createAuthenticatedRequest('GET', '/api/v1/line-items')
      const response = await GET(request)
      
      expectSuccessResponse(response)
      const data = await parseResponse(response)
      
      expectPaginatedResponse(data)
      expect(data.data).toHaveLength(2)
      expect(data.data[0].id).toBe('item_1')
    })

    it('should filter by tab ID', async () => {
      const request = createAuthenticatedRequest('GET', '/api/v1/line-items', {
        searchParams: { tabId: 'tab_123' }
      })
      
      const response = await GET(request)
      expectSuccessResponse(response)
      
      expect(mockDb.select).toHaveBeenCalled()
    })

    it('should filter by billing group', async () => {
      const request = createAuthenticatedRequest('GET', '/api/v1/line-items', {
        searchParams: { billingGroupId: 'group_123' }
      })
      
      const response = await GET(request)
      expectSuccessResponse(response)
    })

    it('should filter unassigned items', async () => {
      const request = createAuthenticatedRequest('GET', '/api/v1/line-items', {
        searchParams: { unassigned: 'true' }
      })
      
      const response = await GET(request)
      expectSuccessResponse(response)
    })

    it('should handle sorting options', async () => {
      const request = createAuthenticatedRequest('GET', '/api/v1/line-items', {
        searchParams: { 
          sortBy: 'totalPrice',
          sortOrder: 'desc'
        }
      })
      
      const response = await GET(request)
      expectSuccessResponse(response)
    })

    it('should return 401 without authentication', async () => {
      const request = createAuthenticatedRequest('GET', '/api/v1/line-items', {
        headers: { 'x-api-key': '' }
      })
      
      const response = await GET(request)
      await expectErrorResponse(response, 401, 'Authentication required')
    })
  })

  describe('POST /api/v1/line-items', () => {
    const validLineItemData = {
      tabId: 'tab_123',
      description: 'Test Product',
      quantity: 2,
      unitPrice: 25.50
    }

    beforeEach(() => {
      const mockLineItem = TestDataFactory.lineItem({ id: 'item_new' })
      mockDbResponse(mockDb, 'insert', [mockLineItem])
      mockDb.query.lineItems.findFirst.mockResolvedValue(mockLineItem)
      mockDb.query.tabs.findFirst.mockResolvedValue(TestDataFactory.tab())
    })

    it('should create a line item', async () => {
      const request = createAuthenticatedRequest('POST', '/api/v1/line-items', {
        body: validLineItemData
      })
      
      const response = await POST(request)
      expectSuccessResponse(response, 201)
      
      const data = await parseResponse(response)
      expect(data.id).toBe('item_new')
      expect(data.description).toBe('Test Product')
      expect(data.totalPrice).toBeDefined()
    })

    it('should validate required fields', async () => {
      const request = createAuthenticatedRequest('POST', '/api/v1/line-items', {
        body: { description: 'Product' } // Missing required fields
      })
      
      const response = await POST(request)
      await expectValidationError(response)
    })

    it('should validate positive quantity', async () => {
      const request = createAuthenticatedRequest('POST', '/api/v1/line-items', {
        body: {
          ...validLineItemData,
          quantity: -1
        }
      })
      
      const response = await POST(request)
      await expectValidationError(response, 'quantity')
    })

    it('should validate positive unit price', async () => {
      const request = createAuthenticatedRequest('POST', '/api/v1/line-items', {
        body: {
          ...validLineItemData,
          unitPrice: 0
        }
      })
      
      const response = await POST(request)
      await expectValidationError(response, 'unitPrice')
    })

    it('should validate tab exists', async () => {
      mockDb.query.tabs.findFirst.mockResolvedValueOnce(null)
      
      const request = createAuthenticatedRequest('POST', '/api/v1/line-items', {
        body: validLineItemData
      })
      
      const response = await POST(request)
      await expectErrorResponse(response, 404, 'Tab not found')
    })

    it('should assign to billing group if provided', async () => {
      mockDb.query.billingGroups.findFirst.mockResolvedValue(TestDataFactory.billingGroup())
      
      const request = createAuthenticatedRequest('POST', '/api/v1/line-items', {
        body: {
          ...validLineItemData,
          billingGroupId: 'group_123'
        }
      })
      
      const response = await POST(request)
      expectSuccessResponse(response, 201)
      
      const data = await parseResponse(response)
      expect(data.billingGroupId).toBe('group_123')
    })

    it('should support metadata', async () => {
      const request = createAuthenticatedRequest('POST', '/api/v1/line-items', {
        body: {
          ...validLineItemData,
          metadata: {
            sku: 'PROD-001',
            category: 'electronics'
          }
        }
      })
      
      const response = await POST(request)
      expectSuccessResponse(response, 201)
      
      const data = await parseResponse(response)
      expect(data.metadata).toMatchObject({
        sku: 'PROD-001',
        category: 'electronics'
      })
    })
  })

  describe('GET /api/v1/line-items/[id]', () => {
    const mockLineItem = TestDataFactory.lineItem()

    beforeEach(() => {
      mockDb.query.lineItems.findFirst.mockResolvedValue(mockLineItem)
    })

    it('should retrieve a line item', async () => {
      const request = createAuthenticatedRequest('GET', '/api/v1/line-items/item_123')
      const response = await getLineItem(request, { params: { id: 'item_123' } })
      
      expectSuccessResponse(response)
      const data = await parseResponse(response)
      
      expect(data.id).toBe('item_123')
      expect(data.description).toBe('Test Item')
    })

    it('should return 404 for non-existent item', async () => {
      mockDb.query.lineItems.findFirst.mockResolvedValue(null)
      
      const request = createAuthenticatedRequest('GET', '/api/v1/line-items/invalid_id')
      const response = await getLineItem(request, { params: { id: 'invalid_id' } })
      
      await expectErrorResponse(response, 404, 'Line item not found')
    })

    it('should include protection status', async () => {
      const request = createAuthenticatedRequest('GET', '/api/v1/line-items/item_123')
      const response = await getLineItem(request, { params: { id: 'item_123' } })
      
      expectSuccessResponse(response)
      const data = await parseResponse(response)
      
      expect(data.protectionStatus).toBeDefined()
    })
  })

  describe('PUT /api/v1/line-items/[id]', () => {
    const mockLineItem = TestDataFactory.lineItem()

    beforeEach(() => {
      mockDb.query.lineItems.findFirst.mockResolvedValue(mockLineItem)
      mockDbResponse(mockDb, 'update', [{ ...mockLineItem, description: 'Updated Item' }])
    })

    it('should update line item details', async () => {
      const request = createAuthenticatedRequest('PUT', '/api/v1/line-items/item_123', {
        body: {
          description: 'Updated Item',
          quantity: 3
        }
      })
      
      const response = await updateLineItem(request, { params: { id: 'item_123' } })
      expectSuccessResponse(response)
      
      const data = await parseResponse(response)
      expect(data.description).toBe('Updated Item')
    })

    it('should prevent updates to protected items', async () => {
      const LineItemCrudService = require('@/lib/services/line-item-crud.service').LineItemCrudService
      LineItemCrudService.checkProtectionStatus.mockResolvedValueOnce({
        isProtected: true,
        hasPayments: true,
        isInPaidInvoice: false,
        isInSentInvoice: false
      })
      
      const request = createAuthenticatedRequest('PUT', '/api/v1/line-items/item_123', {
        body: { description: 'Updated Item' }
      })
      
      const response = await updateLineItem(request, { params: { id: 'item_123' } })
      await expectErrorResponse(response, 400, 'Cannot update protected line item')
    })

    it('should allow force update with flag', async () => {
      const LineItemCrudService = require('@/lib/services/line-item-crud.service').LineItemCrudService
      LineItemCrudService.checkProtectionStatus.mockResolvedValueOnce({
        isProtected: true,
        hasPayments: true,
        isInPaidInvoice: false,
        isInSentInvoice: false
      })
      
      const request = createAuthenticatedRequest('PUT', '/api/v1/line-items/item_123', {
        body: {
          description: 'Force Updated Item',
          force: true
        }
      })
      
      const response = await updateLineItem(request, { params: { id: 'item_123' } })
      expectSuccessResponse(response)
    })

    it('should validate update data', async () => {
      const request = createAuthenticatedRequest('PUT', '/api/v1/line-items/item_123', {
        body: {
          quantity: -5
        }
      })
      
      const response = await updateLineItem(request, { params: { id: 'item_123' } })
      await expectValidationError(response, 'quantity')
    })

    it('should update billing group assignment', async () => {
      mockDb.query.billingGroups.findFirst.mockResolvedValue(TestDataFactory.billingGroup())
      
      const request = createAuthenticatedRequest('PUT', '/api/v1/line-items/item_123', {
        body: {
          billingGroupId: 'group_new'
        }
      })
      
      const response = await updateLineItem(request, { params: { id: 'item_123' } })
      expectSuccessResponse(response)
    })
  })

  describe('DELETE /api/v1/line-items/[id]', () => {
    const mockLineItem = TestDataFactory.lineItem()

    beforeEach(() => {
      mockDb.query.lineItems.findFirst.mockResolvedValue(mockLineItem)
      mockDbResponse(mockDb, 'delete', [mockLineItem])
    })

    it('should delete an unprotected line item', async () => {
      const request = createAuthenticatedRequest('DELETE', '/api/v1/line-items/item_123')
      const response = await deleteLineItem(request, { params: { id: 'item_123' } })
      
      expectSuccessResponse(response, 204)
    })

    it('should prevent deletion of protected items', async () => {
      const LineItemCrudService = require('@/lib/services/line-item-crud.service').LineItemCrudService
      LineItemCrudService.checkProtectionStatus.mockResolvedValueOnce({
        isProtected: true,
        hasPayments: false,
        isInPaidInvoice: true,
        isInSentInvoice: false
      })
      
      const request = createAuthenticatedRequest('DELETE', '/api/v1/line-items/item_123')
      const response = await deleteLineItem(request, { params: { id: 'item_123' } })
      
      await expectErrorResponse(response, 400, 'Cannot delete protected line item')
    })

    it('should allow force deletion with flag', async () => {
      const LineItemCrudService = require('@/lib/services/line-item-crud.service').LineItemCrudService
      LineItemCrudService.checkProtectionStatus.mockResolvedValueOnce({
        isProtected: true,
        hasPayments: false,
        isInPaidInvoice: true,
        isInSentInvoice: false
      })
      
      const request = createAuthenticatedRequest('DELETE', '/api/v1/line-items/item_123', {
        searchParams: { force: 'true' }
      })
      
      const response = await deleteLineItem(request, { params: { id: 'item_123' } })
      expectSuccessResponse(response, 204)
    })
  })

  describe('POST /api/v1/line-items/[id]/assign', () => {
    const mockLineItem = TestDataFactory.lineItem()

    beforeEach(() => {
      mockDb.query.lineItems.findFirst.mockResolvedValue(mockLineItem)
      mockDb.query.billingGroups.findFirst.mockResolvedValue(TestDataFactory.billingGroup())
    })

    it('should assign line item to billing group', async () => {
      const request = createAuthenticatedRequest('POST', '/api/v1/line-items/item_123/assign', {
        body: {
          billingGroupId: 'group_123'
        }
      })
      
      const response = await assignLineItem(request, { params: { id: 'item_123' } })
      expectSuccessResponse(response)
      
      const data = await parseResponse(response)
      expect(data.success).toBe(true)
    })

    it('should validate billing group exists', async () => {
      mockDb.query.billingGroups.findFirst.mockResolvedValueOnce(null)
      
      const request = createAuthenticatedRequest('POST', '/api/v1/line-items/item_123/assign', {
        body: {
          billingGroupId: 'invalid_group'
        }
      })
      
      const response = await assignLineItem(request, { params: { id: 'item_123' } })
      await expectErrorResponse(response, 404, 'Billing group not found')
    })

    it('should prevent reassignment of protected items', async () => {
      const LineItemCrudService = require('@/lib/services/line-item-crud.service').LineItemCrudService
      LineItemCrudService.checkProtectionStatus.mockResolvedValueOnce({
        isProtected: true,
        hasPayments: true,
        isInPaidInvoice: false,
        isInSentInvoice: false
      })
      
      const request = createAuthenticatedRequest('POST', '/api/v1/line-items/item_123/assign', {
        body: {
          billingGroupId: 'group_123'
        }
      })
      
      const response = await assignLineItem(request, { params: { id: 'item_123' } })
      await expectErrorResponse(response, 400, 'Cannot reassign protected line item')
    })
  })

  describe('POST /api/v1/line-items/[id]/unassign', () => {
    const mockLineItem = TestDataFactory.lineItem({ billingGroupId: 'group_123' })

    beforeEach(() => {
      mockDb.query.lineItems.findFirst.mockResolvedValue(mockLineItem)
    })

    it('should unassign line item from billing group', async () => {
      const request = createAuthenticatedRequest('POST', '/api/v1/line-items/item_123/unassign')
      const response = await unassignLineItem(request, { params: { id: 'item_123' } })
      
      expectSuccessResponse(response)
      const data = await parseResponse(response)
      expect(data.success).toBe(true)
    })

    it('should handle already unassigned items', async () => {
      mockDb.query.lineItems.findFirst.mockResolvedValue(
        TestDataFactory.lineItem({ billingGroupId: null })
      )
      
      const request = createAuthenticatedRequest('POST', '/api/v1/line-items/item_123/unassign')
      const response = await unassignLineItem(request, { params: { id: 'item_123' } })
      
      await expectErrorResponse(response, 400, 'Line item is not assigned')
    })
  })

  describe('GET /api/v1/line-items/[id]/protection-status', () => {
    const mockLineItem = TestDataFactory.lineItem()

    beforeEach(() => {
      mockDb.query.lineItems.findFirst.mockResolvedValue(mockLineItem)
    })

    it('should return protection status', async () => {
      const request = createAuthenticatedRequest('GET', '/api/v1/line-items/item_123/protection-status')
      const response = await getProtectionStatus(request, { params: { id: 'item_123' } })
      
      expectSuccessResponse(response)
      const data = await parseResponse(response)
      
      expect(data).toMatchObject({
        isProtected: expect.any(Boolean),
        hasPayments: expect.any(Boolean),
        isInPaidInvoice: expect.any(Boolean),
        isInSentInvoice: expect.any(Boolean)
      })
    })
  })

  describe('POST /api/v1/line-items/bulk-assign', () => {
    const mockLineItems = [
      TestDataFactory.lineItem({ id: 'item_1' }),
      TestDataFactory.lineItem({ id: 'item_2' })
    ]

    beforeEach(() => {
      mockDb.query.lineItems.findMany.mockResolvedValue(mockLineItems)
      mockDb.query.billingGroups.findFirst.mockResolvedValue(TestDataFactory.billingGroup())
    })

    it('should bulk assign line items to billing group', async () => {
      const request = createAuthenticatedRequest('POST', '/api/v1/line-items/bulk-assign', {
        body: {
          lineItemIds: ['item_1', 'item_2'],
          billingGroupId: 'group_123'
        }
      })
      
      const response = await bulkAssign(request)
      expectSuccessResponse(response)
      
      const data = await parseResponse(response)
      expect(data.updated).toBe(2)
      expect(data.skipped).toBe(0)
    })

    it('should skip protected items', async () => {
      const LineItemCrudService = require('@/lib/services/line-item-crud.service').LineItemCrudService
      LineItemCrudService.checkProtectionStatus
        .mockResolvedValueOnce({ isProtected: false })
        .mockResolvedValueOnce({ isProtected: true })
      
      const request = createAuthenticatedRequest('POST', '/api/v1/line-items/bulk-assign', {
        body: {
          lineItemIds: ['item_1', 'item_2'],
          billingGroupId: 'group_123'
        }
      })
      
      const response = await bulkAssign(request)
      expectSuccessResponse(response)
      
      const data = await parseResponse(response)
      expect(data.updated).toBe(1)
      expect(data.skipped).toBe(1)
    })

    it('should validate input', async () => {
      const request = createAuthenticatedRequest('POST', '/api/v1/line-items/bulk-assign', {
        body: {
          lineItemIds: [], // Empty array
          billingGroupId: 'group_123'
        }
      })
      
      const response = await bulkAssign(request)
      await expectValidationError(response, 'lineItemIds')
    })

    it('should limit bulk operations', async () => {
      const tooManyIds = Array(101).fill(0).map((_, i) => `item_${i}`)
      
      const request = createAuthenticatedRequest('POST', '/api/v1/line-items/bulk-assign', {
        body: {
          lineItemIds: tooManyIds,
          billingGroupId: 'group_123'
        }
      })
      
      const response = await bulkAssign(request)
      await expectValidationError(response, 'lineItemIds')
    })
  })

  describe('POST /api/v1/line-items/bulk-operations', () => {
    const mockLineItems = [
      TestDataFactory.lineItem({ id: 'item_1' }),
      TestDataFactory.lineItem({ id: 'item_2' })
    ]

    beforeEach(() => {
      mockDb.query.lineItems.findMany.mockResolvedValue(mockLineItems)
    })

    it('should perform bulk update operation', async () => {
      const request = createAuthenticatedRequest('POST', '/api/v1/line-items/bulk-operations', {
        body: {
          operation: 'update',
          lineItemIds: ['item_1', 'item_2'],
          data: {
            metadata: { bulk: true }
          }
        }
      })
      
      const response = await bulkOperations(request)
      expectSuccessResponse(response)
      
      const data = await parseResponse(response)
      expect(data.success).toBe(true)
      expect(data.affected).toBe(2)
    })

    it('should perform bulk delete operation', async () => {
      const request = createAuthenticatedRequest('POST', '/api/v1/line-items/bulk-operations', {
        body: {
          operation: 'delete',
          lineItemIds: ['item_1', 'item_2']
        }
      })
      
      const response = await bulkOperations(request)
      expectSuccessResponse(response)
      
      const data = await parseResponse(response)
      expect(data.success).toBe(true)
      expect(data.deleted).toBe(2)
    })

    it('should validate operation type', async () => {
      const request = createAuthenticatedRequest('POST', '/api/v1/line-items/bulk-operations', {
        body: {
          operation: 'invalid',
          lineItemIds: ['item_1']
        }
      })
      
      const response = await bulkOperations(request)
      await expectValidationError(response, 'operation')
    })

    it('should respect protection status in bulk operations', async () => {
      const LineItemCrudService = require('@/lib/services/line-item-crud.service').LineItemCrudService
      LineItemCrudService.checkProtectionStatus
        .mockResolvedValueOnce({ isProtected: false })
        .mockResolvedValueOnce({ isProtected: true })
      
      const request = createAuthenticatedRequest('POST', '/api/v1/line-items/bulk-operations', {
        body: {
          operation: 'delete',
          lineItemIds: ['item_1', 'item_2']
        }
      })
      
      const response = await bulkOperations(request)
      expectSuccessResponse(response)
      
      const data = await parseResponse(response)
      expect(data.deleted).toBe(1)
      expect(data.skipped).toBe(1)
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockDb.select.mockRejectedValueOnce(new Error('Database connection failed'))
      
      const request = createAuthenticatedRequest('GET', '/api/v1/line-items')
      const response = await GET(request)
      
      await expectErrorResponse(response, 500)
    })

    it('should handle concurrent modifications', async () => {
      const mockLineItem = TestDataFactory.lineItem({ updatedAt: new Date('2023-01-01') })
      mockDb.query.lineItems.findFirst.mockResolvedValue(mockLineItem)
      
      const request = createAuthenticatedRequest('PUT', '/api/v1/line-items/item_123', {
        body: {
          description: 'Updated Item',
          ifMatch: '2023-01-01T00:00:00.000Z'
        }
      })
      
      const response = await updateLineItem(request, { params: { id: 'item_123' } })
      expectSuccessResponse(response)
    })

    it('should handle decimal precision for prices', async () => {
      const request = createAuthenticatedRequest('POST', '/api/v1/line-items', {
        body: {
          tabId: 'tab_123',
          description: 'Precision Test',
          quantity: 1.5,
          unitPrice: 33.33
        }
      })
      
      mockDb.query.tabs.findFirst.mockResolvedValue(TestDataFactory.tab())
      const mockLineItem = TestDataFactory.lineItem({ 
        id: 'item_new',
        quantity: '1.5',
        unitPrice: '33.33',
        totalPrice: '49.995'
      })
      mockDbResponse(mockDb, 'insert', [mockLineItem])
      
      const response = await POST(request)
      expectSuccessResponse(response, 201)
      
      const data = await parseResponse(response)
      expect(parseFloat(data.totalPrice)).toBeCloseTo(49.995, 2)
    })
  })
})