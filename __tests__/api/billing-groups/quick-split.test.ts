import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { NextRequest, NextResponse } from 'next/server'
import { POST } from '@/app/api/v1/tabs/[id]/quick-split/route'
import { BillingGroupService } from '@/lib/services/billing-group.service'
import { db } from '@/lib/db'
import { withApiAuth } from '@/lib/api/middleware'

// Mock the services
jest.mock('@/lib/services/billing-group.service')
jest.mock('@/lib/logger')

// Get mocked db
const mockDb = db as jest.Mocked<typeof db>
const mockBillingGroupService = BillingGroupService as jest.Mocked<typeof BillingGroupService>

const mockContext = {
  organizationId: 'org_123',
  userId: 'user_123'
}

describe('/api/v1/tabs/[id]/quick-split', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Initialize all mocks
    mockBillingGroupService.getTabBillingGroups = jest.fn()
    mockBillingGroupService.enableBillingGroups = jest.fn()
    mockBillingGroupService.createBillingGroup = jest.fn()
    mockBillingGroupService.assignLineItem = jest.fn()
    mockBillingGroupService.bulkAssignLineItems = jest.fn()
    mockBillingGroupService.getBillingGroupById = jest.fn()
    mockBillingGroupService.createRule = jest.fn()
  })

  describe('POST - Quick split a tab using templates', () => {
    const mockTab = {
      id: 'tab_123',
      organizationId: 'org_123'
    }

    const mockLineItems = [
      {
        id: 'li_1',
        description: 'Coffee',
        category: 'beverages',
        tabId: 'tab_123'
      },
      {
        id: 'li_2',
        description: 'Sandwich',
        category: 'food',
        tabId: 'tab_123'
      },
      {
        id: 'li_3',
        description: 'Dessert',
        category: 'food',
        tabId: 'tab_123'
      }
    ]

    const mockCreatedGroups = [
      {
        id: 'bg_1',
        name: 'Group 1',
        groupType: 'standard'
      },
      {
        id: 'bg_2',
        name: 'Group 2',
        groupType: 'standard'
      }
    ]

    beforeEach(() => {
      // Mock database operations - handle multiple calls
      let callCount = 0
      mockDb.select.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // First call - tab lookup
          return {
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([mockTab])
              })
            })
          }
        } else {
          // Second call - line items lookup
          return {
            from: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue(mockLineItems)
            })
          }
        }
      })

      // Mock check for existing billing groups - none exist
      mockDb.query.billingGroups.findFirst.mockResolvedValue(null)

      // Mock billing group creation - make sure to mock the function itself
      mockBillingGroupService.createBillingGroup = jest.fn()
        .mockResolvedValueOnce(mockCreatedGroups[0])
        .mockResolvedValueOnce(mockCreatedGroups[1])

      // Mock bulk assignment
      mockBillingGroupService.bulkAssignLineItems = jest.fn().mockResolvedValue(undefined)
    })

    describe('Even split scenarios', () => {
      it('should split tab evenly between 2 groups', async () => {
        const request = new NextRequest('http://localhost/api/v1/tabs/tab_123/quick-split', {
          method: 'POST',
          body: JSON.stringify({
            split_type: 'even',
            number_of_groups: 2
          })
        })

        const response = await POST(request, mockContext, { params: { id: 'tab_123' } })
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.message).toBe('Tab split successfully')
        expect(data.split_type).toBe('even')
        expect(data.groups_created).toBe(2)
        expect(data.items_assigned).toBe(3)

        // Should create 2 groups
        expect(mockBillingGroupService.createBillingGroup).toHaveBeenCalledTimes(2)
        expect(mockBillingGroupService.createBillingGroup).toHaveBeenCalledWith({
          tabId: 'tab_123',
          name: 'Group 1',
          groupType: 'standard'
        })

        // Should assign items evenly
        expect(mockBillingGroupService.bulkAssignLineItems).toHaveBeenCalledWith([
          { line_item_id: 'li_1', billing_group_id: 'bg_1' },
          { line_item_id: 'li_2', billing_group_id: 'bg_2' },
          { line_item_id: 'li_3', billing_group_id: 'bg_1' }
        ])
      })

      it('should split tab evenly between 4 groups', async () => {
        // Mock additional groups
        const moreGroups = [
          { id: 'bg_3', name: 'Group 3', groupType: 'standard' },
          { id: 'bg_4', name: 'Group 4', groupType: 'standard' }
        ]

        mockBillingGroupService.createBillingGroup
          .mockResolvedValueOnce(mockCreatedGroups[0] as any)
          .mockResolvedValueOnce(mockCreatedGroups[1] as any)
          .mockResolvedValueOnce(moreGroups[0] as any)
          .mockResolvedValueOnce(moreGroups[1] as any)

        const request = new NextRequest('http://localhost/api/v1/tabs/tab_123/quick-split', {
          method: 'POST',
          body: JSON.stringify({
            split_type: 'even',
            number_of_groups: 4
          })
        })

        const response = await POST(request, mockContext, { params: { id: 'tab_123' } })
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.groups_created).toBe(4)
        expect(mockBillingGroupService.createBillingGroup).toHaveBeenCalledTimes(4)
      })

      it('should reject invalid number of groups', async () => {
        const request = new NextRequest('http://localhost/api/v1/tabs/tab_123/quick-split', {
          method: 'POST',
          body: JSON.stringify({
            split_type: 'even',
            number_of_groups: 1 // Too few
          })
        })

        const response = await POST(request, mockContext, { params: { id: 'tab_123' } })
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Validation error')
      })
    })

    describe('Corporate vs Personal split', () => {
      it('should split based on corporate/personal rules', async () => {
        const corporateGroup = { id: 'bg_corp', name: 'Corporate Expenses', groupType: 'corporate' }
        const personalGroup = { id: 'bg_pers', name: 'Personal Expenses', groupType: 'standard' }

        mockBillingGroupService.createBillingGroup
          .mockResolvedValueOnce(corporateGroup as any)
          .mockResolvedValueOnce(personalGroup as any)

        const request = new NextRequest('http://localhost/api/v1/tabs/tab_123/quick-split', {
          method: 'POST',
          body: JSON.stringify({
            split_type: 'corporate_personal',
            rules: {
              corporate: {
                categories: ['business_meals'],
                time_range: { start: '09:00', end: '17:00' },
                weekdays_only: true
              },
              personal: {
                categories: ['spa', 'entertainment']
              }
            }
          })
        })

        const response = await POST(request, mockContext, { params: { id: 'tab_123' } })
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.groups_created).toBe(2)
        expect(mockBillingGroupService.createBillingGroup).toHaveBeenCalledWith({
          tabId: 'tab_123',
          name: 'Corporate Expenses',
          groupType: 'corporate'
        })
      })
    })

    describe('Category-based split', () => {
      it('should create groups based on item categories', async () => {
        const beverageGroup = { id: 'bg_bev', name: 'Beverages', groupType: 'standard' }
        const foodGroup = { id: 'bg_food', name: 'Food', groupType: 'standard' }

        mockBillingGroupService.createBillingGroup
          .mockResolvedValueOnce(beverageGroup as any)
          .mockResolvedValueOnce(foodGroup as any)

        const request = new NextRequest('http://localhost/api/v1/tabs/tab_123/quick-split', {
          method: 'POST',
          body: JSON.stringify({
            split_type: 'by_category'
          })
        })

        const response = await POST(request, mockContext, { params: { id: 'tab_123' } })
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.groups_created).toBe(2)
        expect(mockBillingGroupService.createBillingGroup).toHaveBeenCalledWith({
          tabId: 'tab_123',
          name: 'Beverages',
          groupType: 'standard'
        })
        expect(mockBillingGroupService.createBillingGroup).toHaveBeenCalledWith({
          tabId: 'tab_123',
          name: 'Food',
          groupType: 'standard'
        })
      })

      it('should handle uncategorized items', async () => {
        const uncategorizedItems = [
          ...mockLineItems,
          {
            id: 'li_4',
            description: 'Mystery Item',
            category: null,
            tabId: 'tab_123'
          }
        ]

        // Override line items mock
        mockDb.select.mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockTab])
            })
          })
        } as any)

        mockDb.select.mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(uncategorizedItems)
          })
        } as any)

        const uncategorizedGroup = { id: 'bg_uncat', name: 'Uncategorized', groupType: 'standard' }
        mockBillingGroupService.createBillingGroup.mockResolvedValueOnce(uncategorizedGroup as any)

        const request = new NextRequest('http://localhost/api/v1/tabs/tab_123/quick-split', {
          method: 'POST',
          body: JSON.stringify({
            split_type: 'by_category'
          })
        })

        const response = await POST(request, mockContext, { params: { id: 'tab_123' } })

        expect(response.status).toBe(200)
        expect(mockBillingGroupService.createBillingGroup).toHaveBeenCalledWith({
          tabId: 'tab_123',
          name: 'Uncategorized',
          groupType: 'standard'
        })
      })
    })

    describe('Error handling', () => {
      beforeEach(() => {
        // Reset mocks to ensure clean state for error tests
        jest.clearAllMocks()
      })

      it('should return 404 if tab not found', async () => {
        // Mock tab not found
        mockDb.select.mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([])
            })
          })
        } as any)

        const request = new NextRequest('http://localhost/api/v1/tabs/tab_999/quick-split', {
          method: 'POST',
          body: JSON.stringify({
            split_type: 'even',
            number_of_groups: 2
          })
        })

        const response = await POST(request, mockContext, { params: { id: 'tab_999' } })
        const data = await response.json()

        expect(response.status).toBe(404)
        expect(data.error).toBe('Tab not found')
      })

      it('should return 403 for unauthorized access', async () => {
        const unauthorizedTab = { ...mockTab, organizationId: 'different_org' }
        
        mockDb.select.mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([unauthorizedTab])
            })
          })
        } as any)

        const request = new NextRequest('http://localhost/api/v1/tabs/tab_123/quick-split', {
          method: 'POST',
          body: JSON.stringify({
            split_type: 'even',
            number_of_groups: 2
          })
        })

        const response = await POST(request, mockContext, { params: { id: 'tab_123' } })
        const data = await response.json()

        expect(response.status).toBe(403)
        expect(data.error).toBe('Unauthorized')
      })

      it('should return 400 if no line items to split', async () => {
        // Mock empty line items
        mockDb.select.mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockTab])
            })
          })
        } as any)

        mockDb.select.mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([])
          })
        } as any)

        const request = new NextRequest('http://localhost/api/v1/tabs/tab_123/quick-split', {
          method: 'POST',
          body: JSON.stringify({
            split_type: 'even',
            number_of_groups: 2
          })
        })

        const response = await POST(request, mockContext, { params: { id: 'tab_123' } })
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('No line items to split')
      })

      it('should handle service errors gracefully', async () => {
        // First ensure tab lookup succeeds
        mockDb.select.mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockTab])
            })
          })
        } as any)

        // Then line items lookup succeeds
        mockDb.select.mockReturnValueOnce({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(mockLineItems)
          })
        } as any)

        // Mock check for existing billing groups
        mockDb.query.billingGroups.findFirst.mockResolvedValue(null)

        // Mock the service to throw error
        mockBillingGroupService.createBillingGroup = jest.fn().mockRejectedValue(
          new Error('Database error')
        )

        const request = new NextRequest('http://localhost/api/v1/tabs/tab_123/quick-split', {
          method: 'POST',
          body: JSON.stringify({
            split_type: 'even',
            number_of_groups: 2
          })
        })

        const response = await POST(request, mockContext, { params: { id: 'tab_123' } })
        const data = await response.json()

        expect(response.status).toBe(500)
        expect(data.error).toBe('Failed to split tab')
      })
    })

    describe('Validation', () => {
      beforeEach(() => {
        // Mock tab lookup for validation tests
        mockDb.select.mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([mockTab])
            })
          })
        })
      })

      it('should validate split_type discriminated union', async () => {
        const request = new NextRequest('http://localhost/api/v1/tabs/tab_123/quick-split', {
          method: 'POST',
          body: JSON.stringify({
            split_type: 'invalid_type'
          })
        })

        const response = await POST(request, mockContext, { params: { id: 'tab_123' } })
        const data = await response.json()

        expect(response.status).toBe(400)
        
        // The error could be a string or an object depending on middleware
        expect(data.error).toBeDefined()
        if (typeof data.error === 'string') {
          expect(data.error).toContain('Validation error')
        } else {
          expect(data.error.message).toBe('Invalid request data')
          expect(data.error.details).toBeDefined()
        }
      })

      it('should validate corporate_personal rules structure', async () => {
        const request = new NextRequest('http://localhost/api/v1/tabs/tab_123/quick-split', {
          method: 'POST',
          body: JSON.stringify({
            split_type: 'corporate_personal',
            rules: {
              corporate: {
                time_range: { start: 'invalid_time' } // Invalid time format
              }
            }
          })
        })

        const response = await POST(request, mockContext, { params: { id: 'tab_123' } })
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Validation error')
      })
    })
  })
})