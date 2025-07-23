// Mock the database client first
jest.mock('@/lib/db/client', () => {
  const mockInsert = jest.fn()
  const mockSelect = jest.fn()
  const mockUpdate = jest.fn()
  const mockDelete = jest.fn()
  const mockFrom = jest.fn()
  const mockWhere = jest.fn()
  const mockInnerJoin = jest.fn()
  const mockLimit = jest.fn()
  const mockSet = jest.fn()
  const mockValues = jest.fn()
  const mockReturning = jest.fn()

  // Set up chaining
  mockInsert.mockReturnValue({ values: mockValues })
  mockValues.mockReturnValue({ returning: mockReturning })
  mockSelect.mockReturnValue({ from: mockFrom })
  mockFrom.mockReturnValue({ where: mockWhere, innerJoin: mockInnerJoin })
  mockWhere.mockReturnValue({ limit: mockLimit, returning: mockReturning })
  mockInnerJoin.mockReturnValue({ where: mockWhere })
  mockUpdate.mockReturnValue({ set: mockSet })
  mockSet.mockReturnValue({ where: mockWhere })
  mockDelete.mockReturnValue({ where: mockWhere })

  return {
    db: {
      insert: mockInsert,
      select: mockSelect,
      update: mockUpdate,
      delete: mockDelete,
      execute: jest.fn(),
    },
    // Export mocks for test access
    __mocks: {
      mockInsert,
      mockSelect,
      mockUpdate,
      mockDelete,
      mockFrom,
      mockWhere,
      mockInnerJoin,
      mockLimit,
      mockSet,
      mockValues,
      mockReturning
    }
  }
})

// Mock the schema tables
jest.mock('@/lib/db/schema', () => ({
  organizations: 'organizations',
  organizationUsers: 'organizationUsers', 
  users: 'users',
  organizationRelationships: 'organizationRelationships',
  apiKeys: 'apiKeys'
}))

// Mock the errors
jest.mock('@/lib/errors', () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'NotFoundError'
    }
  },
  ValidationError: class ValidationError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'ValidationError'
    }
  }
}))

import { OrganizationService } from '@/lib/services/organization.service'
import { db } from '@/lib/db/client'

// Get mocks after imports
const { __mocks } = require('@/lib/db/client')
const { mockInsert, mockSelect, mockUpdate, mockDelete, mockFrom, mockWhere, mockInnerJoin, mockLimit, mockSet, mockValues, mockReturning } = __mocks

describe('OrganizationService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('addUserToOrganization', () => {
    it('should add user to organization', async () => {
      const mockUser = {
        id: 'membership-123',
        organizationId: 'org-123',
        userId: 'user-123',
        role: 'member',
        status: 'active',
        joinedAt: new Date()
      }

      mockReturning.mockResolvedValueOnce([mockUser])

      const result = await OrganizationService.addUserToOrganization({
        organizationId: 'org-123',
        userId: 'user-123',
        role: 'member',
        status: 'active',
        joinedAt: new Date()
      })

      expect(mockInsert).toHaveBeenCalledWith('organizationUsers')
      expect(mockValues).toHaveBeenCalledWith({
        organizationId: 'org-123',
        userId: 'user-123',
        role: 'member',
        status: 'active',
        joinedAt: expect.any(Date)
      })
      expect(result).toEqual(mockUser)
    })
  })

  describe('getOrganizationById', () => {
    it('should return organization when found', async () => {
      const mockOrganization = {
        id: 'org-123',
        name: 'Test Organization',
        slug: 'test-organization'
      }

      mockLimit.mockResolvedValueOnce([mockOrganization])

      const result = await OrganizationService.getOrganizationById('org-123')

      expect(mockSelect).toHaveBeenCalled()
      expect(result).toEqual(mockOrganization)
    })

    it('should return null when organization not found', async () => {
      mockLimit.mockResolvedValueOnce([])

      const result = await OrganizationService.getOrganizationById('org-123')

      expect(result).toBeNull()
    })
  })

  describe('checkRoleHierarchy', () => {
    const testCases = [
      { userRole: 'owner', requiredRole: 'owner', expected: true },
      { userRole: 'owner', requiredRole: 'admin', expected: true },
      { userRole: 'owner', requiredRole: 'member', expected: true },
      { userRole: 'owner', requiredRole: 'viewer', expected: true },
      { userRole: 'admin', requiredRole: 'owner', expected: false },
      { userRole: 'admin', requiredRole: 'admin', expected: true },
      { userRole: 'member', requiredRole: 'admin', expected: false },
      { userRole: 'viewer', requiredRole: 'viewer', expected: true },
    ]

    testCases.forEach(({ userRole, requiredRole, expected }) => {
      it(`${userRole} ${expected ? 'should' : 'should not'} have access to ${requiredRole} level`, () => {
        const result = OrganizationService.checkRoleHierarchy(
          userRole as any,
          requiredRole as any
        )
        expect(result).toBe(expected)
      })
    })
  })
})