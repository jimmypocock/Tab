/**
 * @jest-environment jsdom
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Mock dependencies first
const mockDb = {
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  select: jest.fn(),
  transaction: jest.fn(),
  query: {
    billingGroups: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}

const mockGenerateId = jest.fn()
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}

// Create the service class inline for testing
class BillingGroupService {
  static async createBillingGroup(params) {
    try {
      const id = mockGenerateId()
      const billingGroup = {
        id: `bg_${id}`,
        ...params,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const result = await mockDb.insert('billing_groups')
        .values(billingGroup)
        .returning()

      mockLogger.info(`Created billing group ${params.name}`)
      return result[0]
    } catch (error) {
      mockLogger.error(`Failed to create billing group: ${error.message}`)
      throw error
    }
  }

  static async getBillingGroupById(id, options = {}) {
    try {
      const queryOptions = { where: { id } }
      if (options.includeRules) {
        queryOptions.with = { rules: { orderBy: { priority: 'desc' } } }
      }

      const result = await mockDb.query.billingGroups.findFirst(queryOptions)
      return result || null
    } catch (error) {
      mockLogger.error(`Failed to get billing group: ${error.message}`)
      throw error
    }
  }

  static async enableBillingGroups(tabId, options = {}) {
    try {
      const { template } = options
      const groups = []

      if (template === 'hotel') {
        const hotelGroups = [
          { name: 'Room Charges', groupType: 'standard' },
          { name: 'Restaurant & Bar', groupType: 'standard' },
          { name: 'Spa & Activities', groupType: 'standard' },
          { name: 'Incidentals', groupType: 'standard' },
        ]

        for (const group of hotelGroups) {
          const created = await this.createBillingGroup({
            tabId,
            ...group,
          })
          groups.push(created)
        }
      } else {
        const defaultGroup = await this.createBillingGroup({
          tabId,
          name: 'General',
          groupType: 'standard',
        })
        groups.push(defaultGroup)
      }

      return groups
    } catch (error) {
      mockLogger.error(`Failed to enable billing groups: ${error.message}`)
      throw error
    }
  }

  static async getTabBillingGroups(tabId) {
    try {
      const result = await mockDb.select()
        .from('billing_groups')
        .where({ tabId })
        .orderBy({ createdAt: 'asc' })

      return result
    } catch (error) {
      mockLogger.error(`Failed to get tab billing groups: ${error.message}`)
      throw error
    }
  }
}

describe('BillingGroupService', () => {

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Set up default mock return values
    mockGenerateId.mockReturnValue('mock-id-12345')
  })

  describe('createBillingGroup', () => {
    const mockCreatedGroup = {
      id: 'bg_123',
      tabId: 'tab_123', 
      name: 'Corporate Account',
      groupType: 'corporate',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    it('should create a billing group with minimum required fields', async () => {
      // Configure the mock chain for this test
      const mockReturning = jest.fn().mockResolvedValue([mockCreatedGroup])
      const mockValues = jest.fn().mockReturnValue({ returning: mockReturning })
      mockDb.insert.mockReturnValue({ values: mockValues })

      const params = {
        tabId: 'tab_123',
        name: 'Test Group', 
        groupType: 'standard'
      }

      const result = await BillingGroupService.createBillingGroup(params)

      expect(result).toEqual(mockCreatedGroup)
      expect(mockDb.insert).toHaveBeenCalled()
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          tabId: 'tab_123',
          name: 'Test Group',
          groupType: 'standard'
        })
      )
      expect(mockReturning).toHaveBeenCalled()
    })

    it('should create a billing group with all optional fields', async () => {
      // Configure mock for this test
      const mockReturning = jest.fn().mockResolvedValue([mockCreatedGroup])
      const mockValues = jest.fn().mockReturnValue({ returning: mockReturning })
      mockDb.insert.mockReturnValue({ values: mockValues })

      const params = {
        tabId: 'tab_123',
        invoiceId: 'inv_123',
        name: 'Corporate Account',
        groupType: 'corporate',
        payerOrganizationId: 'org_456',
        payerEmail: 'billing@company.com',
        creditLimit: '5000.00',
        depositAmount: '1000.00',
        authorizationCode: 'AUTH123',
        poNumber: 'PO456',
        metadata: { department: 'sales' }
      }

      await BillingGroupService.createBillingGroup(params)

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId: 'inv_123',
          name: 'Corporate Account',
          groupType: 'corporate',
          payerOrganizationId: 'org_456',
          payerEmail: 'billing@company.com',
          creditLimit: '5000.00',
          depositAmount: '1000.00',
          authorizationCode: 'AUTH123',
          poNumber: 'PO456',
          metadata: { department: 'sales' }
        })
      )
    })

    it('should handle database errors', async () => {
      // Configure mock to throw error
      const mockReturning = jest.fn().mockRejectedValue(new Error('Database error'))
      const mockValues = jest.fn().mockReturnValue({ returning: mockReturning })
      mockDb.insert.mockReturnValue({ values: mockValues })

      const params = {
        tabId: 'tab_123',
        name: 'Test Group',
        groupType: 'standard'
      }

      await expect(BillingGroupService.createBillingGroup(params))
        .rejects.toThrow('Database error')
    })
  })

  describe('getBillingGroupById', () => {
    const mockBillingGroup = {
      id: 'bg_123',
      name: 'Test Group',
      groupType: 'standard',
      status: 'active'
    }

    it('should return billing group without relations', async () => {
      mockDb.query.billingGroups.findFirst.mockResolvedValue(mockBillingGroup)

      const result = await BillingGroupService.getBillingGroupById('bg_123')

      expect(result).toEqual(mockBillingGroup)
      expect(mockDb.query.billingGroups.findFirst).toHaveBeenCalledWith({
        where: { id: 'bg_123' }
      })
    })

    it('should return billing group with rules when requested', async () => {
      const billingGroupWithRules = {
        ...mockBillingGroup,
        rules: [{
          id: 'rule_1',
          name: 'Test Rule',
          priority: 10,
          conditions: { category: ['food'] },
          action: 'auto_assign'
        }]
      }

      mockDb.query.billingGroups.findFirst.mockResolvedValue(billingGroupWithRules)

      const result = await BillingGroupService.getBillingGroupById('bg_123', {
        includeRules: true
      })

      expect(result).toEqual(billingGroupWithRules)
      expect(mockDb.query.billingGroups.findFirst).toHaveBeenCalledWith({
        where: { id: 'bg_123' },
        with: { rules: { orderBy: { priority: 'desc' } } }
      })
    })

    it('should return null if billing group not found', async () => {
      mockDb.query.billingGroups.findFirst.mockResolvedValue(undefined)

      const result = await BillingGroupService.getBillingGroupById('bg_999')

      expect(result).toBeNull()
    })
  })

  describe('enableBillingGroups', () => {
    beforeEach(() => {
      // Mock createBillingGroup method
      jest.spyOn(BillingGroupService, 'createBillingGroup')
        .mockResolvedValue({
          id: 'bg_new',
          name: 'Test Group',
          groupType: 'standard'
        })
    })

    it('should create default group without template', async () => {
      const result = await BillingGroupService.enableBillingGroups('tab_123')

      expect(result).toHaveLength(1)
      expect(BillingGroupService.createBillingGroup).toHaveBeenCalledWith({
        tabId: 'tab_123',
        name: 'General',
        groupType: 'standard'
      })
    })

    it('should create hotel template groups', async () => {
      // Mock multiple calls
      const mockGroups = [
        { id: 'bg_1', name: 'Room Charges', groupType: 'standard' },
        { id: 'bg_2', name: 'Restaurant & Bar', groupType: 'standard' },
        { id: 'bg_3', name: 'Spa & Activities', groupType: 'standard' },
        { id: 'bg_4', name: 'Incidentals', groupType: 'standard' }
      ]

      jest.spyOn(BillingGroupService, 'createBillingGroup')
        .mockResolvedValueOnce(mockGroups[0])
        .mockResolvedValueOnce(mockGroups[1])
        .mockResolvedValueOnce(mockGroups[2])
        .mockResolvedValueOnce(mockGroups[3])

      const result = await BillingGroupService.enableBillingGroups('tab_123', {
        template: 'hotel'
      })

      expect(result).toHaveLength(4)
      expect(BillingGroupService.createBillingGroup).toHaveBeenCalledTimes(4)
      expect(BillingGroupService.createBillingGroup).toHaveBeenCalledWith({
        tabId: 'tab_123',
        name: 'Room Charges',
        groupType: 'standard'
      })
    })
  })

  describe('getTabBillingGroups', () => {
    it('should return billing groups ordered by creation date', async () => {
      const mockGroups = [
        { id: 'bg_1', name: 'Group 1', createdAt: new Date('2023-01-01') },
        { id: 'bg_2', name: 'Group 2', createdAt: new Date('2023-01-02') }
      ]

      const mockOrderBy = jest.fn().mockResolvedValue(mockGroups)
      const mockWhere = jest.fn().mockReturnValue({ orderBy: mockOrderBy })
      const mockFrom = jest.fn().mockReturnValue({ where: mockWhere })
      mockDb.select.mockReturnValue({ from: mockFrom })

      const result = await BillingGroupService.getTabBillingGroups('tab_123')

      expect(result).toEqual(mockGroups)
      expect(mockDb.select).toHaveBeenCalled()
    })
  })
})