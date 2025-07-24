import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'

// Mock the BillingGroupService module properly
jest.mock('@/lib/services/billing-group.service')
jest.mock('@/lib/logger')

// Import routes after mocks
import { GET, POST } from '@/app/api/v1/billing-groups/[id]/rules/route'
import { BillingGroupService } from '@/lib/services/billing-group.service'

// Type the mocked service
const mockBillingGroupService = BillingGroupService as jest.Mocked<typeof BillingGroupService>

const mockContext = {
  organizationId: 'org_123',
  userId: 'user_123'
}

describe('/api/v1/billing-groups/[id]/rules', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET - List rules for a billing group', () => {
    const mockBillingGroupWithRules = {
      id: 'bg_123',
      name: 'Corporate Account',
      rules: [
        {
          id: 'rule_1',
          name: 'Business Hours Rule',
          priority: 10,
          conditions: {
            category: ['business_meals', 'transport'],
            amount: { min: 0, max: 500 },
            time: { start: '09:00', end: '17:00' },
            dayOfWeek: [1, 2, 3, 4, 5]
          },
          action: 'auto_assign',
          metadata: { department: 'sales' }
        },
        {
          id: 'rule_2',
          name: 'High Amount Approval',
          priority: 5,
          conditions: {
            amount: { min: 500 }
          },
          action: 'require_approval',
          metadata: {}
        }
      ]
    }

    beforeEach(() => {
      mockBillingGroupService.getBillingGroupById = jest.fn().mockResolvedValue(mockBillingGroupWithRules as any)
    })

    it('should return all rules for a billing group', async () => {
      const request = new NextRequest('http://localhost/api/v1/billing-groups/bg_123/rules')

      const response = await GET(request, mockContext, { params: { id: 'bg_123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.rules).toHaveLength(2)
      expect(data.rules[0]).toEqual({
        id: 'rule_1',
        name: 'Business Hours Rule',
        priority: 10,
        conditions: {
          category: ['business_meals', 'transport'],
          amount: { min: 0, max: 500 },
          time: { start: '09:00', end: '17:00' },
          dayOfWeek: [1, 2, 3, 4, 5]
        },
        action: 'auto_assign',
        metadata: { department: 'sales' }
      })

      expect(BillingGroupService.getBillingGroupById).toHaveBeenCalledWith('bg_123', {
        includeRules: true
      })
    })

    it('should return empty array for billing group with no rules', async () => {
      const billingGroupNoRules = {
        id: 'bg_123',
        name: 'Simple Group',
        rules: []
      }

      mockBillingGroupService.getBillingGroupById = jest.fn().mockResolvedValue(billingGroupNoRules as any)

      const request = new NextRequest('http://localhost/api/v1/billing-groups/bg_123/rules')
      const response = await GET(request, mockContext, { params: { id: 'bg_123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.rules).toEqual([])
    })

    it('should handle billing group with null rules', async () => {
      const billingGroupNullRules = {
        id: 'bg_123',
        name: 'Group Without Rules',
        rules: null
      }

      mockBillingGroupService.getBillingGroupById = jest.fn().mockResolvedValue(billingGroupNullRules as any)

      const request = new NextRequest('http://localhost/api/v1/billing-groups/bg_123/rules')
      const response = await GET(request, mockContext, { params: { id: 'bg_123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.rules).toEqual([])
    })

    it('should return 404 if billing group not found', async () => {
      mockBillingGroupService.getBillingGroupById = jest.fn().mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/v1/billing-groups/bg_999/rules')
      const response = await GET(request, mockContext, { params: { id: 'bg_999' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Billing group not found')
    })

    it('should handle service errors gracefully', async () => {
      mockBillingGroupService.getBillingGroupById = jest.fn().mockRejectedValue(
        new Error('Database error')
      )

      const request = new NextRequest('http://localhost/api/v1/billing-groups/bg_123/rules')
      const response = await GET(request, mockContext, { params: { id: 'bg_123' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch rules')
    })
  })

  describe('POST - Create a new rule', () => {
    const mockBillingGroup = {
      id: 'bg_123',
      name: 'Corporate Account'
    }

    const mockCreatedRule = {
      id: 'rule_new',
      billingGroupId: 'bg_123',
      name: 'Weekend Charges',
      priority: 50,
      conditions: {
        category: ['entertainment'],
        dayOfWeek: [0, 6]
      },
      action: 'auto_assign',
      metadata: {}
    }

    beforeEach(() => {
      mockBillingGroupService.getBillingGroupById = jest.fn().mockResolvedValue(mockBillingGroup as any)
      mockBillingGroupService.createRule = jest.fn().mockResolvedValue(mockCreatedRule as any)
    })

    it('should create a new rule successfully', async () => {
      const ruleData = {
        name: 'Weekend Charges',
        priority: 50,
        conditions: {
          category: ['entertainment'],
          day_of_week: [0, 6]
        },
        action: 'auto_assign'
      }

      const request = new NextRequest('http://localhost/api/v1/billing-groups/bg_123/rules', {
        method: 'POST',
        body: JSON.stringify(ruleData)
      })

      const response = await POST(request, mockContext, { params: { id: 'bg_123' } })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.rule).toEqual(mockCreatedRule)

      expect(BillingGroupService.createRule).toHaveBeenCalledWith({
        billingGroupId: 'bg_123',
        name: 'Weekend Charges',
        priority: 50,
        conditions: {
          category: ['entertainment'],
          dayOfWeek: [0, 6],
          amount: undefined,
          time: undefined,
          metadata: undefined
        },
        action: 'auto_assign',
        metadata: undefined
      })
    })

    it('should use default values', async () => {
      const minimalRuleData = {
        name: 'Basic Rule',
        conditions: {}
      }

      const request = new NextRequest('http://localhost/api/v1/billing-groups/bg_123/rules', {
        method: 'POST',
        body: JSON.stringify(minimalRuleData)
      })

      const response = await POST(request, mockContext, { params: { id: 'bg_123' } })

      expect(response.status).toBe(201)
      expect(BillingGroupService.createRule).toHaveBeenCalledWith({
        billingGroupId: 'bg_123',
        name: 'Basic Rule',
        priority: 100,
        conditions: {
          category: undefined,
          dayOfWeek: undefined,
          amount: undefined,
          time: undefined,
          metadata: undefined
        },
        action: 'auto_assign',
        metadata: undefined
      })
    })

    it('should validate required fields', async () => {
      const invalidData = {
        // Missing required 'name' field
        conditions: {}
      }

      const request = new NextRequest('http://localhost/api/v1/billing-groups/bg_123/rules', {
        method: 'POST',
        body: JSON.stringify(invalidData)
      })

      const response = await POST(request, mockContext, { params: { id: 'bg_123' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBeDefined()
      if (data.error && typeof data.error === 'object') {
        expect(data.error.message).toBe('Invalid request data')
        expect(data.error.details).toBeDefined()
      }
    })

    it('should validate time format', async () => {
      const invalidTimeData = {
        name: 'Invalid Time Rule',
        conditions: {
          time: { start: 'invalid', end: '17:00' }
        }
      }

      const request = new NextRequest('http://localhost/api/v1/billing-groups/bg_123/rules', {
        method: 'POST',
        body: JSON.stringify(invalidTimeData)
      })

      const response = await POST(request, mockContext, { params: { id: 'bg_123' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation error')
    })

    it('should validate day of week values', async () => {
      const invalidDayData = {
        name: 'Invalid Day Rule',
        conditions: {
          day_of_week: [7, 8] // Valid range is 0-6
        }
      }

      const request = new NextRequest('http://localhost/api/v1/billing-groups/bg_123/rules', {
        method: 'POST',
        body: JSON.stringify(invalidDayData)
      })

      const response = await POST(request, mockContext, { params: { id: 'bg_123' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation error')
    })

    it('should validate amount values are positive', async () => {
      const invalidAmountData = {
        name: 'Invalid Amount Rule',
        conditions: {
          amount: { min: -100, max: 500 }
        }
      }

      const request = new NextRequest('http://localhost/api/v1/billing-groups/bg_123/rules', {
        method: 'POST',
        body: JSON.stringify(invalidAmountData)
      })

      const response = await POST(request, mockContext, { params: { id: 'bg_123' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation error')
    })

    it('should validate action enum values', async () => {
      const invalidActionData = {
        name: 'Invalid Action Rule',
        conditions: {},
        action: 'invalid_action'
      }

      const request = new NextRequest('http://localhost/api/v1/billing-groups/bg_123/rules', {
        method: 'POST',
        body: JSON.stringify(invalidActionData)
      })

      const response = await POST(request, mockContext, { params: { id: 'bg_123' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation error')
    })

    it('should return 404 if billing group not found', async () => {
      mockBillingGroupService.getBillingGroupById = jest.fn().mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/v1/billing-groups/bg_999/rules', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Rule',
          conditions: {}
        })
      })

      const response = await POST(request, mockContext, { params: { id: 'bg_999' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Billing group not found')
    })

    it('should handle service errors gracefully', async () => {
      mockBillingGroupService.createRule = jest.fn().mockRejectedValue(
        new Error('Database error')
      )

      const request = new NextRequest('http://localhost/api/v1/billing-groups/bg_123/rules', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Rule',
          conditions: {}
        })
      })

      const response = await POST(request, mockContext, { params: { id: 'bg_123' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to create rule')
    })
  })
})