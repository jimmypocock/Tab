import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { NextRequest } from 'next/server'

// Mock the service before importing the route
jest.mock('@/lib/services/billing-group.service')
jest.mock('@/lib/logger')

import { GET } from '@/app/api/v1/tabs/[id]/billing-summary/route'
import { BillingGroupService } from '@/lib/services/billing-group.service'
import { db } from '@/lib/db'
import { withApiAuth } from '@/lib/api/middleware'

// Get mocked db
const mockDb = db as jest.Mocked<typeof db>
const mockBillingGroupService = BillingGroupService as jest.Mocked<typeof BillingGroupService>
const mockWithApiAuth = withApiAuth as jest.MockedFunction<typeof withApiAuth>

const mockContext = {
  organizationId: 'org_123',
  userId: 'user_123'
}

describe('/api/v1/tabs/[id]/billing-summary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    mockWithApiAuth.mockImplementation((handler) => {
      return async (req: NextRequest, context: any) => {
        return handler(req, mockContext, context)
      }
    })
  })

  describe('GET - Get billing summary for a tab', () => {
    const mockTab = {
      id: 'tab_123',
      organizationId: 'org_123',
      totalAmount: '150.00',
      status: 'open'
    }

    const mockBillingSummary = {
      groups: [
        {
          billingGroup: {
            id: 'bg_1',
            name: 'Corporate Account',
            groupType: 'corporate',
            status: 'active',
            payerEmail: 'corp@company.com',
            payerOrganizationId: 'corp_org_123',
            creditLimit: '5000.00',
            currentBalance: '1200.00',
            depositAmount: '500.00',
            depositApplied: '100.00'
          },
          lineItems: [
            {
              id: 'li_1',
              description: 'Business Lunch',
              quantity: 1,
              unitPrice: '50.00',
              total: '50.00'
            }
          ],
          total: 50.00,
          depositRemaining: 400.00
        },
        {
          billingGroup: {
            id: 'bg_2',
            name: 'Personal Expenses',
            groupType: 'standard',
            status: 'active',
            payerEmail: 'john@personal.com',
            payerOrganizationId: null,
            creditLimit: null,
            currentBalance: '0.00',
            depositAmount: null,
            depositApplied: null
          },
          lineItems: [
            {
              id: 'li_2',
              description: 'Spa Treatment',
              quantity: 1,
              unitPrice: '75.00',
              total: '75.00'
            }
          ],
          total: 75.00,
          depositRemaining: 0
        }
      ],
      unassignedItems: [
        {
          id: 'li_3',
          description: 'Minibar',
          quantity: 2,
          unitPrice: '12.50',
          total: '25.00'
        }
      ],
      totalAmount: 150.00
    }

    beforeEach(() => {
      // Mock tab lookup
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockTab])
          })
        })
      } as any)

      // Mock billing summary service
      mockBillingGroupService.getTabBillingSummary = jest.fn().mockResolvedValue(mockBillingSummary)
    })

    it('should return complete billing summary', async () => {
      const request = new NextRequest('http://localhost/api/v1/tabs/tab_123/billing-summary')

      const response = await GET(request, mockContext, { params: { id: 'tab_123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toEqual({
        tab_id: 'tab_123',
        tab_status: 'open',
        tab_total: 150.00,
        billing_summary: {
          groups: [
            {
              billing_group: {
                id: 'bg_1',
                name: 'Corporate Account',
                type: 'corporate',
                status: 'active',
                payer_email: 'corp@company.com',
                payer_organization_id: 'corp_org_123',
                credit_limit: 5000.00,
                current_balance: 1200.00,
                deposit_amount: 500.00,
                deposit_applied: 100.00
              },
              line_items_count: 1,
              total: 50.00,
              deposit_remaining: 400.00
            },
            {
              billing_group: {
                id: 'bg_2',
                name: 'Personal Expenses',
                type: 'standard',
                status: 'active',
                payer_email: 'john@personal.com',
                payer_organization_id: null,
                credit_limit: null,
                current_balance: 0.00,
                deposit_amount: 0,
                deposit_applied: 0
              },
              line_items_count: 1,
              total: 75.00,
              deposit_remaining: 0
            }
          ],
          unassigned_items: [
            {
              id: 'li_3',
              description: 'Minibar',
              quantity: 2,
              unit_price: 12.50,
              total: 25.00
            }
          ],
          unassigned_count: 1,
          total_amount: 150.00
        }
      })

      expect(mockBillingGroupService.getTabBillingSummary).toHaveBeenCalledWith('tab_123')
    })

    it('should handle tabs with no billing groups', async () => {
      const noBillingSummary = {
        groups: [],
        unassignedItems: [
          {
            id: 'li_1',
            description: 'Coffee',
            quantity: 1,
            unitPrice: '5.00',
            total: '5.00'
          }
        ],
        totalAmount: 5.00
      }

      mockBillingGroupService.getTabBillingSummary = jest.fn().mockResolvedValue(noBillingSummary)

      const request = new NextRequest('http://localhost/api/v1/tabs/tab_123/billing-summary')
      const response = await GET(request, mockContext, { params: { id: 'tab_123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.billing_summary.groups).toHaveLength(0)
      expect(data.billing_summary.unassigned_items).toHaveLength(1)
      expect(data.billing_summary.total_amount).toBe(5.00)
    })

    it('should handle empty tabs', async () => {
      const emptySummary = {
        groups: [],
        unassignedItems: [],
        totalAmount: 0
      }

      mockBillingGroupService.getTabBillingSummary = jest.fn().mockResolvedValue(emptySummary)

      const request = new NextRequest('http://localhost/api/v1/tabs/tab_123/billing-summary')
      const response = await GET(request, mockContext, { params: { id: 'tab_123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.billing_summary.groups).toHaveLength(0)
      expect(data.billing_summary.unassigned_items).toHaveLength(0)
      expect(data.billing_summary.total_amount).toBe(0)
    })

    it('should handle billing groups with null values gracefully', async () => {
      const summaryWithNulls = {
        groups: [
          {
            billingGroup: {
              id: 'bg_1',
              name: 'Simple Group',
              groupType: 'standard',
              status: 'active',
              payerEmail: null,
              payerOrganizationId: null,
              creditLimit: null,
              currentBalance: '0.00',
              depositAmount: null,
              depositApplied: null
            },
            lineItems: [],
            total: 0,
            depositRemaining: 0
          }
        ],
        unassignedItems: [],
        totalAmount: 0
      }

      mockBillingGroupService.getTabBillingSummary = jest.fn().mockResolvedValue(summaryWithNulls)

      const request = new NextRequest('http://localhost/api/v1/tabs/tab_123/billing-summary')
      const response = await GET(request, mockContext, { params: { id: 'tab_123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.billing_summary.groups[0].billing_group).toEqual({
        id: 'bg_1',
        name: 'Simple Group',
        type: 'standard',
        status: 'active',
        payer_email: null,
        payer_organization_id: null,
        credit_limit: null,
        current_balance: 0.00,
        deposit_amount: 0,
        deposit_applied: 0
      })
    })

    it('should return 404 if tab not found', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([])
          })
        })
      } as any)

      const request = new NextRequest('http://localhost/api/v1/tabs/tab_999/billing-summary')
      const response = await GET(request, mockContext, { params: { id: 'tab_999' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Tab not found')
    })

    it('should return 403 for unauthorized access', async () => {
      const unauthorizedTab = {
        ...mockTab,
        organizationId: 'different_org'
      }

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([unauthorizedTab])
          })
        })
      } as any)

      const request = new NextRequest('http://localhost/api/v1/tabs/tab_123/billing-summary')
      const response = await GET(request, mockContext, { params: { id: 'tab_123' } })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Unauthorized')
    })

    it('should handle service errors gracefully', async () => {
      mockBillingGroupService.getTabBillingSummary = jest.fn().mockRejectedValue(
        new Error('Database connection failed')
      )

      const request = new NextRequest('http://localhost/api/v1/tabs/tab_123/billing-summary')
      const response = await GET(request, mockContext, { params: { id: 'tab_123' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch billing summary')
    })

    it('should properly format decimal values', async () => {
      const summaryWithDecimals = {
        groups: [
          {
            billingGroup: {
              id: 'bg_1',
              name: 'Test Group',
              groupType: 'standard',
              status: 'active',
              payerEmail: 'test@example.com',
              payerOrganizationId: null,
              creditLimit: '1000.99',
              currentBalance: '123.456', // Should round to 2 decimal places
              depositAmount: '50.1',
              depositApplied: '25.05'
            },
            lineItems: [],
            total: 99.99,
            depositRemaining: 25.05
          }
        ],
        unassignedItems: [],
        totalAmount: 99.99
      }

      mockBillingGroupService.getTabBillingSummary = jest.fn().mockResolvedValue(summaryWithDecimals)

      const request = new NextRequest('http://localhost/api/v1/tabs/tab_123/billing-summary')
      const response = await GET(request, mockContext, { params: { id: 'tab_123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.billing_summary.groups[0].billing_group.credit_limit).toBe(1000.99)
      expect(data.billing_summary.groups[0].billing_group.current_balance).toBe(123.456)
      expect(data.billing_summary.groups[0].billing_group.deposit_amount).toBe(50.1)
    })

    it('should include all required fields in response', async () => {
      const request = new NextRequest('http://localhost/api/v1/tabs/tab_123/billing-summary')
      const response = await GET(request, mockContext, { params: { id: 'tab_123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      
      // Check top-level structure
      expect(data).toHaveProperty('tab_id')
      expect(data).toHaveProperty('tab_status')
      expect(data).toHaveProperty('tab_total')
      expect(data).toHaveProperty('billing_summary')
      
      // Check billing summary structure
      expect(data.billing_summary).toHaveProperty('groups')
      expect(data.billing_summary).toHaveProperty('unassigned_items')
      expect(data.billing_summary).toHaveProperty('unassigned_count')
      expect(data.billing_summary).toHaveProperty('total_amount')
      
      // Check billing group structure
      if (data.billing_summary.groups.length > 0) {
        const group = data.billing_summary.groups[0]
        expect(group).toHaveProperty('billing_group')
        expect(group).toHaveProperty('line_items_count')
        expect(group).toHaveProperty('total')
        expect(group).toHaveProperty('deposit_remaining')
        
        // Check billing group details
        expect(group.billing_group).toHaveProperty('id')
        expect(group.billing_group).toHaveProperty('name')
        expect(group.billing_group).toHaveProperty('type')
        expect(group.billing_group).toHaveProperty('status')
      }
    })
  })
})