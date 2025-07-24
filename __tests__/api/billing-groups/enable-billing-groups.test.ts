import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'

// Mock the services
jest.mock('@/lib/services/billing-group.service')
jest.mock('@/lib/logger')

// Import after mocks
import { POST } from '@/app/api/v1/tabs/[id]/enable-billing-groups/route'
import { db } from '@/lib/db'
import { BillingGroupService } from '@/lib/services/billing-group.service'

// Get mocked db
const mockDb = db as jest.Mocked<typeof db>
// Get mocked services
const mockBillingGroupService = BillingGroupService as jest.Mocked<typeof BillingGroupService>
const mockWithApiAuth = withApiAuth as jest.MockedFunction<typeof withApiAuth>

// Mock context for API auth
const mockContext = {
  organizationId: 'org_123',
  userId: 'user_123'
}

describe('/api/v1/tabs/[id]/enable-billing-groups', () => {
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
    
    // withApiAuth is already mocked globally, no need to re-mock it here
  })

  describe('POST - Enable billing groups for a tab', () => {
    const mockTab = {
      id: 'tab_123',
      organizationId: 'org_123'
    }

    const mockCreatedGroups = [
      {
        id: 'bg_1',
        name: 'General',
        groupType: 'standard',
        status: 'active'
      }
    ]

    beforeEach(() => {
      // Reset all mocks
      jest.clearAllMocks()
      
      // Use global database mock - don't override it
      // The global mock in jest.setup.ts should handle all database operations
      // Just ensure specific queries return expected data
      
      // Mock database for route's direct tab lookup
      const mockLimit = jest.fn().mockResolvedValue([mockTab])
      const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit })
      const mockFrom = jest.fn().mockReturnValue({ where: mockWhere })
      mockDb.select.mockReturnValue({ from: mockFrom })
      
      // Mock service methods - make sure they resolve to avoid database calls
      mockBillingGroupService.getTabBillingGroups.mockResolvedValue([])
      mockBillingGroupService.enableBillingGroups.mockResolvedValue(mockCreatedGroups as any)
    })

    it('should enable billing groups with default template', async () => {
      const request = new NextRequest('http://localhost/api/v1/tabs/tab_123/enable-billing-groups', {
        method: 'POST',
        body: JSON.stringify({})
      })

      const response = await POST(request, mockContext, { params: { id: 'tab_123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Billing groups enabled successfully')
      expect(data.groups).toHaveLength(1)
      expect(data.groups[0]).toEqual({
        id: 'bg_1',
        name: 'General',
        type: 'standard',
        status: 'active'
      })

      expect(mockBillingGroupService.enableBillingGroups).toHaveBeenCalledWith('tab_123', {
        template: undefined,
        defaultGroups: undefined
      })
    })

    it('should enable billing groups with hotel template', async () => {
      const request = new NextRequest('http://localhost/api/v1/tabs/tab_123/enable-billing-groups', {
        method: 'POST',
        body: JSON.stringify({
          template: 'hotel'
        })
      })

      const response = await POST(request, mockContext, { params: { id: 'tab_123' } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockBillingGroupService.enableBillingGroups).toHaveBeenCalledWith('tab_123', {
        template: 'hotel',
        defaultGroups: undefined
      })
    })

    it('should enable billing groups with custom groups', async () => {
      const customGroups = [
        { name: 'Room Service', type: 'standard' },
        { name: 'Corporate Account', type: 'corporate' }
      ]

      const request = new NextRequest('http://localhost/api/v1/tabs/tab_123/enable-billing-groups', {
        method: 'POST',
        body: JSON.stringify({
          default_groups: customGroups
        })
      })

      const response = await POST(request, mockContext, { params: { id: 'tab_123' } })

      expect(response.status).toBe(200)
      expect(mockBillingGroupService.enableBillingGroups).toHaveBeenCalledWith('tab_123', {
        template: undefined,
        defaultGroups: customGroups
      })
    })

    it('should return 404 if tab not found', async () => {
      const mockLimit = jest.fn().mockResolvedValue([])
      const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit })
      const mockFrom = jest.fn().mockReturnValue({ where: mockWhere })
      mockDb.select.mockReturnValue({ from: mockFrom })

      const request = new NextRequest('http://localhost/api/v1/tabs/tab_999/enable-billing-groups', {
        method: 'POST'
      })

      const response = await POST(request, mockContext, { params: { id: 'tab_999' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Tab not found')
    })

    it('should return 403 if tab belongs to different organization', async () => {
      const unauthorizedTab = { ...mockTab, organizationId: 'different_org' }
      
      const mockLimit = jest.fn().mockResolvedValue([unauthorizedTab])
      const mockWhere = jest.fn().mockReturnValue({ limit: mockLimit })
      const mockFrom = jest.fn().mockReturnValue({ where: mockWhere })
      mockDb.select.mockReturnValue({ from: mockFrom })

      const request = new NextRequest('http://localhost/api/v1/tabs/tab_123/enable-billing-groups', {
        method: 'POST'
      })

      const response = await POST(request, mockContext, { params: { id: 'tab_123' } })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 400 if billing groups already enabled', async () => {
      mockBillingGroupService.getTabBillingGroups.mockResolvedValue([
        { id: 'existing_bg', name: 'Existing Group' } as any
      ])

      const request = new NextRequest('http://localhost/api/v1/tabs/tab_123/enable-billing-groups', {
        method: 'POST'
      })

      const response = await POST(request, mockContext, { params: { id: 'tab_123' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Billing groups already enabled for this tab')
    })

    it('should return 400 for invalid template', async () => {
      // Mock tab lookup
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockTab])
          })
        })
      } as any)

      const request = new NextRequest('http://localhost/api/v1/tabs/tab_123/enable-billing-groups', {
        method: 'POST',
        body: JSON.stringify({
          template: 'invalid_template'
        })
      })

      const response = await POST(request, mockContext, { params: { id: 'tab_123' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      // Just check that we got a validation error of some kind
      expect(data.error).toBeDefined()
      // The error could be an object or string depending on middleware
      if (typeof data.error === 'object') {
        expect(data.error.message).toBe('Invalid request data')
      } else {
        expect(data.error).toContain('Validation error')
      }
    })

    it('should handle service errors gracefully', async () => {
      mockBillingGroupService.enableBillingGroups.mockRejectedValue(
        new Error('Database connection failed')
      )

      const request = new NextRequest('http://localhost/api/v1/tabs/tab_123/enable-billing-groups', {
        method: 'POST'
      })

      const response = await POST(request, mockContext, { params: { id: 'tab_123' } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to enable billing groups')
    })

    it('should validate request body schema', async () => {
      // Mock tab lookup
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockTab])
          })
        })
      } as any)

      const request = new NextRequest('http://localhost/api/v1/tabs/tab_123/enable-billing-groups', {
        method: 'POST',
        body: JSON.stringify({
          template: 'hotel',
          default_groups: [
            { name: '', type: 'invalid' } // Invalid group
          ]
        })
      })

      const response = await POST(request, mockContext, { params: { id: 'tab_123' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      
      // Handle both middleware and direct error formats
      expect(data.error).toBeDefined()
      if (typeof data.error === 'object' && data.error.message) {
        expect(data.error.message).toBe('Invalid request data')
        expect(data.error.details).toBeDefined()
      } else if (typeof data.error === 'string') {
        // Just check that we get a validation error
        expect(data.error).toContain('Validation error')
      }
    })
  })
})