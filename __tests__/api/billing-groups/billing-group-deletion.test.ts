import { NextRequest } from 'next/server'
import { DELETE } from '@/app/api/v1/billing-groups/[id]/route'
import { GET } from '@/app/api/v1/billing-groups/[id]/validate-deletion/route'
import { BillingGroupDeletionService } from '@/lib/services/billing-group-deletion.service'
import { BillingGroupService } from '@/lib/services/billing-group.service'
import { db } from '@/lib/db'

// Mock dependencies
jest.mock('@/lib/services/billing-group-deletion.service')
jest.mock('@/lib/services/billing-group.service')
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

const mockBillingGroupDeletionService = BillingGroupDeletionService as jest.Mocked<typeof BillingGroupDeletionService>
const mockBillingGroupService = BillingGroupService as jest.Mocked<typeof BillingGroupService>
const mockDb = db as jest.Mocked<typeof db>

// Mock withApiAuth middleware
const mockContext = {
  organizationId: 'org_123',
  apiKeyId: 'key_456',
  requestId: 'req_789',
  environment: 'test' as const
}

// Create mock withApiAuth that calls the handler directly
jest.mock('@/lib/api/middleware', () => ({
  withApiAuth: (handler: any) => (req: any, context: any, extra: any) => {
    return handler(req, mockContext, extra)
  }
}))

describe('Billing Group Deletion Endpoints', () => {
  const billingGroupId = 'bg_123'
  const userId = 'user_456'

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

  describe('GET /api/v1/billing-groups/[id]/validate-deletion', () => {
    it('should return validation result when deletion is allowed', async () => {
      const mockValidation = {
        canDelete: true,
        blockers: [],
        warnings: ['2 unpaid line items will be moved to default billing group'],
        billingGroup: {
          id: billingGroupId,
          name: 'Test Group',
          groupType: 'company',
          status: 'active',
          invoiceId: null
        }
      }

      mockBillingGroupDeletionService.validateDeletion.mockResolvedValue(mockValidation)

      const request = new NextRequest(`http://localhost/api/v1/billing-groups/${billingGroupId}/validate-deletion`)
      const response = await GET(request, mockContext, { params: { id: billingGroupId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(mockValidation)
      expect(mockBillingGroupDeletionService.validateDeletion).toHaveBeenCalledWith(
        billingGroupId,
        mockContext.organizationId
      )
    })

    it('should return validation result when deletion is blocked', async () => {
      const mockValidation = {
        canDelete: false,
        blockers: [
          {
            type: 'invoice',
            count: 1,
            message: 'Cannot delete billing group with paid invoice (INV-001). Amount paid: $150.00'
          },
          {
            type: 'payment',
            count: 2,
            message: 'Cannot delete billing group with 2 successful payment(s). These must be preserved for financial records.'
          }
        ],
        warnings: [],
        billingGroup: {
          id: billingGroupId,
          name: 'Production Group',
          groupType: 'company',
          status: 'active',
          invoiceId: 'inv_123'
        }
      }

      mockBillingGroupDeletionService.validateDeletion.mockResolvedValue(mockValidation)

      const request = new NextRequest(`http://localhost/api/v1/billing-groups/${billingGroupId}/validate-deletion`)
      const response = await GET(request, mockContext, { params: { id: billingGroupId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual(mockValidation)
      expect(data.canDelete).toBe(false)
      expect(data.blockers).toHaveLength(2)
    })

    it('should handle billing group not found', async () => {
      mockBillingGroupDeletionService.validateDeletion.mockRejectedValue(
        new Error('Billing group not found')
      )

      const request = new NextRequest(`http://localhost/api/v1/billing-groups/${billingGroupId}/validate-deletion`)
      const response = await GET(request, mockContext, { params: { id: billingGroupId } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Billing group not found')
    })

    it('should handle permission errors', async () => {
      mockBillingGroupDeletionService.validateDeletion.mockRejectedValue(
        new Error('You do not have permission to access this billing group')
      )

      const request = new NextRequest(`http://localhost/api/v1/billing-groups/${billingGroupId}/validate-deletion`)
      const response = await GET(request, mockContext, { params: { id: billingGroupId } })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Insufficient permissions')
    })
  })

  describe('DELETE /api/v1/billing-groups/[id]', () => {
    it('should delete billing group when validation passes', async () => {
      const mockValidation = {
        canDelete: true,
        blockers: [],
        warnings: ['2 unpaid line items will be reassigned'],
        billingGroup: {
          id: billingGroupId,
          name: 'Test Group',
          groupType: 'company',
          status: 'active',
          invoiceId: null
        }
      }

      const deleteOptions = {
        moveLineItemsToGroupId: 'bg_default_123',
        force: false
      }

      mockBillingGroupDeletionService.validateDeletion.mockResolvedValue(mockValidation)
      mockBillingGroupService.getBillingGroupById.mockResolvedValue({ id: 'bg_default_123' } as any)
      mockBillingGroupDeletionService.deleteBillingGroup.mockResolvedValue(undefined)

      const request = new NextRequest(`http://localhost/api/v1/billing-groups/${billingGroupId}`, {
        method: 'DELETE',
        body: JSON.stringify(deleteOptions),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await DELETE(request, mockContext, { params: { id: billingGroupId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Billing group deleted successfully')
      expect(data.warnings).toEqual(mockValidation.warnings)
      
      expect(mockBillingGroupDeletionService.validateDeletion).toHaveBeenCalledWith(
        billingGroupId,
        mockContext.organizationId
      )
      expect(mockBillingGroupDeletionService.deleteBillingGroup).toHaveBeenCalledWith(
        billingGroupId,
        mockContext.organizationId,
        userId,
        {
          skipValidation: false,
          moveLineItemsToGroupId: deleteOptions.moveLineItemsToGroupId
        }
      )
    })

    it('should reject deletion when blocked by payments', async () => {
      const mockValidation = {
        canDelete: false,
        blockers: [
          {
            type: 'payment',
            count: 3,
            message: 'Cannot delete billing group with 3 successful payment(s) totaling $450.00. These must be preserved for financial records.'
          }
        ],
        warnings: [],
        billingGroup: {
          id: billingGroupId,
          name: 'Paid Group',
          groupType: 'company',
          status: 'active',
          invoiceId: 'inv_456'
        }
      }

      mockBillingGroupDeletionService.validateDeletion.mockResolvedValue(mockValidation)

      const request = new NextRequest(`http://localhost/api/v1/billing-groups/${billingGroupId}`, {
        method: 'DELETE',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await DELETE(request, mockContext, { params: { id: billingGroupId } })
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error).toBe('Cannot delete billing group')
      expect(data.blockers).toEqual(mockValidation.blockers)
      expect(data.billingGroup).toEqual(mockValidation.billingGroup)
      
      // Should not call delete when blocked
      expect(mockBillingGroupDeletionService.deleteBillingGroup).not.toHaveBeenCalled()
    })

    it('should allow forced deletion with override', async () => {
      const mockValidation = {
        canDelete: false,
        blockers: [
          {
            type: 'payment',
            count: 1,
            message: 'Cannot delete billing group with 1 successful payment(s)'
          }
        ],
        warnings: [],
        billingGroup: {
          id: billingGroupId,
          name: 'Protected Group',
          groupType: 'company',
          status: 'active',
          invoiceId: null
        }
      }

      const deleteOptions = {
        force: true
      }

      mockBillingGroupDeletionService.validateDeletion.mockResolvedValue(mockValidation)
      mockBillingGroupDeletionService.deleteBillingGroup.mockResolvedValue(undefined)

      const request = new NextRequest(`http://localhost/api/v1/billing-groups/${billingGroupId}`, {
        method: 'DELETE',
        body: JSON.stringify(deleteOptions),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await DELETE(request, mockContext, { params: { id: billingGroupId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Billing group deleted successfully')
      
      expect(mockBillingGroupDeletionService.deleteBillingGroup).toHaveBeenCalledWith(
        billingGroupId,
        mockContext.organizationId,
        userId,
        {
          skipValidation: true,
          moveLineItemsToGroupId: undefined
        }
      )
    })

    it('should validate target billing group exists', async () => {
      const mockValidation = {
        canDelete: true,
        blockers: [],
        warnings: [],
        billingGroup: {
          id: billingGroupId,
          name: 'Test Group',
          groupType: 'company',
          status: 'active',
          invoiceId: null
        }
      }

      const deleteOptions = {
        moveLineItemsToGroupId: 'bg_nonexistent'
      }

      mockBillingGroupDeletionService.validateDeletion.mockResolvedValue(mockValidation)
      mockBillingGroupService.getBillingGroupById.mockResolvedValue(null)

      const request = new NextRequest(`http://localhost/api/v1/billing-groups/${billingGroupId}`, {
        method: 'DELETE',
        body: JSON.stringify(deleteOptions),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await DELETE(request, mockContext, { params: { id: billingGroupId } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Target billing group for line items not found')
      
      // Should not call delete when target group is invalid
      expect(mockBillingGroupDeletionService.deleteBillingGroup).not.toHaveBeenCalled()
    })

    it('should handle empty request body gracefully', async () => {
      const mockValidation = {
        canDelete: true,
        blockers: [],
        warnings: [],
        billingGroup: {
          id: billingGroupId,
          name: 'Test Group',
          groupType: 'company',
          status: 'active',
          invoiceId: null
        }
      }

      mockBillingGroupDeletionService.validateDeletion.mockResolvedValue(mockValidation)
      mockBillingGroupDeletionService.deleteBillingGroup.mockResolvedValue(undefined)

      const request = new NextRequest(`http://localhost/api/v1/billing-groups/${billingGroupId}`, {
        method: 'DELETE'
      })

      const response = await DELETE(request, mockContext, { params: { id: billingGroupId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Billing group deleted successfully')
      
      expect(mockBillingGroupDeletionService.deleteBillingGroup).toHaveBeenCalledWith(
        billingGroupId,
        mockContext.organizationId,
        userId,
        {
          skipValidation: false,
          moveLineItemsToGroupId: undefined
        }
      )
    })

    it('should handle validation errors in request body', async () => {
      const invalidOptions = {
        moveLineItemsToGroupId: 'invalid-uuid',
        force: 'not-boolean' as any
      }

      const request = new NextRequest(`http://localhost/api/v1/billing-groups/${billingGroupId}`, {
        method: 'DELETE',
        body: JSON.stringify(invalidOptions),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await DELETE(request, mockContext, { params: { id: billingGroupId } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid deletion options')
      expect(data.details).toBeDefined()
    })

    it('should handle service errors appropriately', async () => {
      const mockValidation = {
        canDelete: true,
        blockers: [],
        warnings: [],
        billingGroup: {
          id: billingGroupId,
          name: 'Test Group',
          groupType: 'company',
          status: 'active',
          invoiceId: null
        }
      }

      mockBillingGroupDeletionService.validateDeletion.mockResolvedValue(mockValidation)
      mockBillingGroupDeletionService.deleteBillingGroup.mockRejectedValue(
        new Error('Database connection failed')
      )

      const request = new NextRequest(`http://localhost/api/v1/billing-groups/${billingGroupId}`, {
        method: 'DELETE'
      })

      const response = await DELETE(request, mockContext, { params: { id: billingGroupId } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to delete billing group')
    })
  })

  describe('Data Integrity Edge Cases', () => {
    it('should handle concurrent deletion attempts', async () => {
      // Test case where billing group is deleted between validation and deletion
      const mockValidation = {
        canDelete: true,
        blockers: [],
        warnings: [],
        billingGroup: {
          id: billingGroupId,
          name: 'Test Group',
          groupType: 'company',
          status: 'active',
          invoiceId: null
        }
      }

      mockBillingGroupDeletionService.validateDeletion.mockResolvedValue(mockValidation)
      mockBillingGroupDeletionService.deleteBillingGroup.mockRejectedValue(
        new Error('Billing group not found')
      )

      const request = new NextRequest(`http://localhost/api/v1/billing-groups/${billingGroupId}`, {
        method: 'DELETE'
      })

      const response = await DELETE(request, mockContext, { params: { id: billingGroupId } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Billing group not found')
    })

    it('should preserve financial data integrity', async () => {
      // Test that paid invoices and successful payments block deletion
      const mockValidation = {
        canDelete: false,
        blockers: [
          {
            type: 'invoice',
            count: 1,
            message: 'Cannot delete billing group with paid invoice (INV-001). Amount paid: $500.00'
          },
          {
            type: 'payment',
            count: 2,
            message: 'Cannot delete billing group with 2 successful payment(s) totaling $500.00'
          }
        ],
        warnings: [],
        billingGroup: {
          id: billingGroupId,
          name: 'Paid Group',
          groupType: 'company',
          status: 'active',
          invoiceId: 'inv_123'
        }
      }

      mockBillingGroupDeletionService.validateDeletion.mockResolvedValue(mockValidation)

      const request = new NextRequest(`http://localhost/api/v1/billing-groups/${billingGroupId}`, {
        method: 'DELETE'
      })

      const response = await DELETE(request, mockContext, { params: { id: billingGroupId } })
      const data = await response.json()

      expect(response.status).toBe(409)
      expect(data.error).toBe('Cannot delete billing group')
      expect(data.blockers).toHaveLength(2)
      expect(mockBillingGroupDeletionService.deleteBillingGroup).not.toHaveBeenCalled()
    })
  })
})