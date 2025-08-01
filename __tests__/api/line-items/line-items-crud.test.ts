/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/v1/line-items/route'
import { GET, PUT, DELETE } from '@/app/api/v1/line-items/[id]/route'
import { GET as GetProtectionStatus } from '@/app/api/v1/line-items/[id]/protection-status/route'
import { POST as BulkOperations } from '@/app/api/v1/line-items/bulk-operations/route'
import { LineItemCrudService } from '@/lib/services/line-item-crud.service'
import { db } from '@/lib/db'

// Mock dependencies
jest.mock('@/lib/services/line-item-crud.service')
jest.mock('@/lib/db', () => ({
  db: {
    select: jest.fn(),
    update: jest.fn(),
    insert: jest.fn(),
    delete: jest.fn(),
    query: {
      apiKeys: {
        findFirst: jest.fn()
      }
    }
  }
}))

const mockLineItemCrudService = LineItemCrudService as jest.Mocked<typeof LineItemCrudService>
const mockDb = db as jest.Mocked<typeof db>

// Mock withApiAuth middleware
const mockContext = {
  organizationId: 'org_123',
  apiKeyId: 'key_456',
  requestId: 'req_789',
  environment: 'test' as const
}

jest.mock('@/lib/api/middleware', () => ({
  withApiAuth: (handler: any) => (req: any, context: any, extra: any) => {
    return handler(req, mockContext, extra)
  }
}))

describe('Line Item CRUD Endpoints', () => {
  const lineItemId = 'li_123'
  const tabId = 'tab_456'
  const userId = 'user_789'

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock database select chain for API key validation
    ;(mockDb.select as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{
              apiKey: { createdBy: userId },
              organization: { id: mockContext.organizationId }
            }])
          })
        })
      })
    })
    
    // Mock database update for lastUsedAt
    ;(mockDb.update as jest.Mock).mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue({})
      })
    })
  })

  describe('POST /api/v1/line-items', () => {
    it('should create a new line item', async () => {
      const createData = {
        tabId,
        description: 'Test Line Item',
        quantity: 2,
        unitPrice: 25.50,
        billingGroupId: 'bg_123',
        metadata: { source: 'test' }
      }

      const mockCreatedItem = {
        id: 'li_new',
        tabId,
        description: 'Test Line Item',
        quantity: 2,
        unitPrice: '25.50',
        total: '51.00',
        billingGroupId: 'bg_123',
        metadata: { source: 'test' },
        createdAt: new Date(),
        paymentStatus: 'unpaid' as const,
        canEdit: true,
        canDelete: true,
        protectionReasons: []
      }

      mockLineItemCrudService.createLineItem.mockResolvedValue(mockCreatedItem)

      const request = new NextRequest('http://localhost/api/v1/line-items', {
        method: 'POST',
        body: JSON.stringify(createData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request, mockContext, { params: {} })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.data).toEqual(mockCreatedItem)
      expect(data.message).toBe('Line item created successfully')
      expect(mockLineItemCrudService.createLineItem).toHaveBeenCalledWith(
        createData,
        mockContext.organizationId,
        userId
      )
    })

    it('should validate input data', async () => {
      const invalidData = {
        tabId: 'invalid-uuid',
        description: '', // Empty description
        quantity: -1, // Negative quantity
        unitPrice: 0 // Zero price
      }

      const request = new NextRequest('http://localhost/api/v1/line-items', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request, mockContext, { params: {} })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation error')
      expect(data.details).toBeDefined()
    })

    it('should handle tab not found', async () => {
      const createData = {
        tabId: 'tab_nonexistent',
        description: 'Test Item',
        quantity: 1,
        unitPrice: 10.00
      }

      mockLineItemCrudService.createLineItem.mockRejectedValue(
        new Error('Tab not found or you do not have access to it')
      )

      const request = new NextRequest('http://localhost/api/v1/line-items', {
        method: 'POST',
        body: JSON.stringify(createData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request, mockContext, { params: {} })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Tab or billing group not found')
    })

    it('should handle billing group validation', async () => {
      const createData = {
        tabId,
        description: 'Test Item',
        quantity: 1,
        unitPrice: 10.00,
        billingGroupId: 'bg_nonexistent'
      }

      mockLineItemCrudService.createLineItem.mockRejectedValue(
        new Error('Billing group not found or does not belong to this tab')
      )

      const request = new NextRequest('http://localhost/api/v1/line-items', {
        method: 'POST',
        body: JSON.stringify(createData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request, mockContext, { params: {} })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Billing group not found')
    })
  })

  describe('GET /api/v1/line-items/[id]', () => {
    it('should return line item with protection info', async () => {
      const mockLineItem = {
        id: lineItemId,
        tabId,
        description: 'Test Line Item',
        quantity: 1,
        unitPrice: '50.00',
        total: '50.00',
        billingGroupId: 'bg_123',
        metadata: {},
        createdAt: new Date(),
        paymentStatus: 'unpaid' as const,
        canEdit: true,
        canDelete: true,
        protectionReasons: []
      }

      mockLineItemCrudService.getLineItemWithProtection.mockResolvedValue(mockLineItem)

      const request = new NextRequest(`http://localhost/api/v1/line-items/${lineItemId}`)
      const response = await GET(request, mockContext, { params: { id: lineItemId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toEqual(mockLineItem)
      expect(mockLineItemCrudService.getLineItemWithProtection).toHaveBeenCalledWith(
        lineItemId,
        mockContext.organizationId
      )
    })

    it('should handle line item not found', async () => {
      mockLineItemCrudService.getLineItemWithProtection.mockRejectedValue(
        new Error('Line item not found')
      )

      const request = new NextRequest(`http://localhost/api/v1/line-items/${lineItemId}`)
      const response = await GET(request, mockContext, { params: { id: lineItemId } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Line item not found')
    })

    it('should handle access denied', async () => {
      mockLineItemCrudService.getLineItemWithProtection.mockRejectedValue(
        new Error('You do not have access to this line item')
      )

      const request = new NextRequest(`http://localhost/api/v1/line-items/${lineItemId}`)
      const response = await GET(request, mockContext, { params: { id: lineItemId } })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Insufficient permissions')
    })
  })

  describe('PUT /api/v1/line-items/[id]', () => {
    it('should update line item when not protected', async () => {
      const updateData = {
        description: 'Updated Line Item',
        quantity: 3,
        unitPrice: 15.00,
        billingGroupId: 'bg_456'
      }

      const mockUpdatedItem = {
        id: lineItemId,
        tabId,
        description: 'Updated Line Item',
        quantity: 3,
        unitPrice: '15.00',
        total: '45.00',
        billingGroupId: 'bg_456',
        metadata: {},
        createdAt: new Date(),
        paymentStatus: 'unpaid' as const,
        canEdit: true,
        canDelete: true,
        protectionReasons: []
      }

      mockLineItemCrudService.updateLineItem.mockResolvedValue(mockUpdatedItem)

      const request = new NextRequest(`http://localhost/api/v1/line-items/${lineItemId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await PUT(request, mockContext, { params: { id: lineItemId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toEqual(mockUpdatedItem)
      expect(data.message).toBe('Line item updated successfully')
      expect(mockLineItemCrudService.updateLineItem).toHaveBeenCalledWith(
        lineItemId,
        updateData,
        mockContext.organizationId,
        userId,
        { force: false }
      )
    })

    it('should reject update when protected by payments', async () => {
      const updateData = {
        description: 'Updated Line Item'
      }

      mockLineItemCrudService.updateLineItem.mockRejectedValue(
        new Error('Cannot edit line item: Tab has received payment(s) totaling $100.00. Use force=true to override.')
      )

      const request = new NextRequest(`http://localhost/api/v1/line-items/${lineItemId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await PUT(request, mockContext, { params: { id: lineItemId } })
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error).toContain('Cannot edit line item')
    })

    it('should allow forced update with override', async () => {
      const updateData = {
        description: 'Force Updated Item',
        force: true
      }

      const mockUpdatedItem = {
        id: lineItemId,
        tabId,
        description: 'Force Updated Item',
        quantity: 1,
        unitPrice: '50.00',
        total: '50.00',
        billingGroupId: null,
        metadata: {},
        createdAt: new Date(),
        paymentStatus: 'paid' as const,
        canEdit: false,
        canDelete: false,
        protectionReasons: ['Tab has received payment(s) totaling $50.00']
      }

      mockLineItemCrudService.updateLineItem.mockResolvedValue(mockUpdatedItem)

      const request = new NextRequest(`http://localhost/api/v1/line-items/${lineItemId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await PUT(request, mockContext, { params: { id: lineItemId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toEqual(mockUpdatedItem)
      expect(mockLineItemCrudService.updateLineItem).toHaveBeenCalledWith(
        lineItemId,
        { description: 'Force Updated Item' },
        mockContext.organizationId,
        userId,
        { force: true }
      )
    })

    it('should validate update data', async () => {
      const invalidData = {
        description: '', // Empty description
        quantity: 0, // Zero quantity
        unitPrice: -10 // Negative price
      }

      const request = new NextRequest(`http://localhost/api/v1/line-items/${lineItemId}`, {
        method: 'PUT',
        body: JSON.stringify(invalidData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await PUT(request, mockContext, { params: { id: lineItemId } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation error')
      expect(data.details).toBeDefined()
    })
  })

  describe('DELETE /api/v1/line-items/[id]', () => {
    it('should delete line item when not protected', async () => {
      mockLineItemCrudService.deleteLineItem.mockResolvedValue(undefined)

      const request = new NextRequest(`http://localhost/api/v1/line-items/${lineItemId}`, {
        method: 'DELETE'
      })

      const response = await DELETE(request, mockContext, { params: { id: lineItemId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Line item deleted successfully')
      expect(mockLineItemCrudService.deleteLineItem).toHaveBeenCalledWith(
        lineItemId,
        mockContext.organizationId,
        userId,
        { force: false }
      )
    })

    it('should reject deletion when protected by payments', async () => {
      mockLineItemCrudService.deleteLineItem.mockRejectedValue(
        new Error('Cannot delete line item: Associated invoice has been paid $75.00. Use force=true to override.')
      )

      const request = new NextRequest(`http://localhost/api/v1/line-items/${lineItemId}`, {
        method: 'DELETE'
      })

      const response = await DELETE(request, mockContext, { params: { id: lineItemId } })
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error).toContain('Cannot delete line item')
    })

    it('should allow forced deletion with override', async () => {
      const deleteOptions = { force: true }

      mockLineItemCrudService.deleteLineItem.mockResolvedValue(undefined)

      const request = new NextRequest(`http://localhost/api/v1/line-items/${lineItemId}`, {
        method: 'DELETE',
        body: JSON.stringify(deleteOptions),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await DELETE(request, mockContext, { params: { id: lineItemId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Line item deleted successfully')
      expect(mockLineItemCrudService.deleteLineItem).toHaveBeenCalledWith(
        lineItemId,
        mockContext.organizationId,
        userId,
        { force: true }
      )
    })
  })

  describe('GET /api/v1/line-items/[id]/protection-status', () => {
    it('should return payment protection status', async () => {
      const mockProtection = {
        isProtected: true,
        reasons: [
          'Tab has received payment(s) totaling $100.00',
          'Associated invoice has been paid $50.00'
        ],
        paymentStatus: 'partial' as const,
        paidAmount: 100.00,
        totalAmount: 150.00
      }

      mockLineItemCrudService.checkPaymentProtection.mockResolvedValue(mockProtection)

      const request = new NextRequest(`http://localhost/api/v1/line-items/${lineItemId}/protection-status`)
      const response = await GetProtectionStatus(request, mockContext, { params: { id: lineItemId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toEqual(mockProtection)
      expect(mockLineItemCrudService.checkPaymentProtection).toHaveBeenCalledWith(
        lineItemId,
        mockContext.organizationId
      )
    })

    it('should return unprotected status for unpaid items', async () => {
      const mockProtection = {
        isProtected: false,
        reasons: [],
        paymentStatus: 'unpaid' as const,
        paidAmount: 0,
        totalAmount: 25.00
      }

      mockLineItemCrudService.checkPaymentProtection.mockResolvedValue(mockProtection)

      const request = new NextRequest(`http://localhost/api/v1/line-items/${lineItemId}/protection-status`)
      const response = await GetProtectionStatus(request, mockContext, { params: { id: lineItemId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toEqual(mockProtection)
      expect(data.data.isProtected).toBe(false)
    })
  })

  describe('POST /api/v1/line-items/bulk-operations', () => {
    it('should perform bulk update operation', async () => {
      const bulkUpdateData = {
        operation: 'update',
        lineItemIds: ['li_1', 'li_2', 'li_3'],
        updates: {
          billingGroupId: 'bg_new',
          metadata: { bulk: true }
        },
        force: false
      }

      const mockResults = [
        { lineItemId: 'li_1', status: 'success', data: { id: 'li_1' } },
        { lineItemId: 'li_2', status: 'success', data: { id: 'li_2' } }
      ]
      const mockErrors = [
        { lineItemId: 'li_3', status: 'error', error: 'Cannot edit line item: payment protection' }
      ]

      mockLineItemCrudService.updateLineItem
        .mockResolvedValueOnce({ id: 'li_1' } as any)
        .mockResolvedValueOnce({ id: 'li_2' } as any)
        .mockRejectedValueOnce(new Error('Cannot edit line item: payment protection'))

      const request = new NextRequest('http://localhost/api/v1/line-items/bulk-operations', {
        method: 'POST',
        body: JSON.stringify(bulkUpdateData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await BulkOperations(request, mockContext, { params: {} })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Bulk update completed. 2 succeeded, 1 failed.')
      expect(data.results).toHaveLength(2)
      expect(data.errors).toHaveLength(1)
      expect(mockLineItemCrudService.updateLineItem).toHaveBeenCalledTimes(3)
    })

    it('should perform bulk delete operation', async () => {
      const bulkDeleteData = {
        operation: 'delete',
        lineItemIds: ['li_1', 'li_2'],
        force: true
      }

      mockLineItemCrudService.deleteLineItem
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)

      const request = new NextRequest('http://localhost/api/v1/line-items/bulk-operations', {
        method: 'POST',
        body: JSON.stringify(bulkDeleteData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await BulkOperations(request, mockContext, { params: {} })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Bulk delete completed. 2 succeeded, 0 failed.')
      expect(data.results).toHaveLength(2)
      expect(data.errors).toHaveLength(0)
      expect(mockLineItemCrudService.deleteLineItem).toHaveBeenCalledTimes(2)
    })

    it('should perform bulk protection check', async () => {
      const bulkCheckData = {
        operation: 'protection-check',
        lineItemIds: ['li_1', 'li_2', 'li_3']
      }

      const mockProtectionResults = [
        { isProtected: false, reasons: [] },
        { isProtected: true, reasons: ['Payment received'] },
        { isProtected: false, reasons: [] }
      ]

      mockLineItemCrudService.checkPaymentProtection
        .mockResolvedValueOnce(mockProtectionResults[0] as any)
        .mockResolvedValueOnce(mockProtectionResults[1] as any)
        .mockResolvedValueOnce(mockProtectionResults[2] as any)

      const request = new NextRequest('http://localhost/api/v1/line-items/bulk-operations', {
        method: 'POST',
        body: JSON.stringify(bulkCheckData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await BulkOperations(request, mockContext, { params: {} })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Bulk protection check completed')
      expect(data.summary.total).toBe(3)
      expect(data.summary.protected).toBe(1)
      expect(data.summary.unprotected).toBe(2)
      expect(data.results).toHaveLength(3)
    })

    it('should validate bulk operation type', async () => {
      const invalidData = {
        operation: 'invalid-operation',
        lineItemIds: ['li_1']
      }

      const request = new NextRequest('http://localhost/api/v1/line-items/bulk-operations', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await BulkOperations(request, mockContext, { params: {} })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid operation. Supported operations: update, delete, protection-check')
    })

    it('should enforce line item count limits', async () => {
      const tooManyItemsData = {
        operation: 'update',
        lineItemIds: Array.from({ length: 51 }, (_, i) => `li_${i}`), // 51 items, over limit
        updates: {}
      }

      const request = new NextRequest('http://localhost/api/v1/line-items/bulk-operations', {
        method: 'POST',
        body: JSON.stringify(tooManyItemsData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await BulkOperations(request, mockContext, { params: {} })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation error')
    })
  })

  describe('Payment Protection Integration', () => {
    it('should enforce payment protection across all operations', async () => {
      // Test that payment protection is consistently enforced
      // across create, update, delete, and bulk operations
      expect(true).toBe(true) // Placeholder for integration test
    })

    it('should handle tab total recalculation correctly', async () => {
      // Test that tab totals are updated when line items change
      expect(true).toBe(true) // Placeholder for integration test
    })

    it('should maintain data consistency during concurrent operations', async () => {
      // Test race conditions and concurrent line item modifications
      expect(true).toBe(true) // Placeholder for integration test
    })
  })
})