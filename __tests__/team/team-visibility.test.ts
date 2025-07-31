import { createClient } from '@/lib/supabase/server'
import { getTeamMembers } from '@/app/(dashboard)/settings/team/actions'

// Mock Next.js modules
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

describe('Team Visibility', () => {
  const mockSupabase = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  }

  const mockOrganizationId = 'org-123'
  const mockOwnerId = 'owner-123'
  const mockAdminId = 'admin-123'
  const mockMemberId = 'member-123'
  const mockViewerId = 'viewer-123'

  beforeEach(() => {
    jest.clearAllMocks()
    ;(createClient as jest.Mock).mockResolvedValue(mockSupabase)
  })

  describe('getTeamMembers', () => {
    it('should allow all team members to see each other', async () => {
      // Setup mock user as a regular member
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockMemberId } },
      })

      // Mock the organization_users query
      const mockMembers = [
        {
          id: '1',
          role: 'owner',
          status: 'active',
          department: null,
          title: null,
          joined_at: '2024-01-01',
          invited_at: null,
          user: { id: mockOwnerId, email: 'owner@example.com' },
        },
        {
          id: '2',
          role: 'admin',
          status: 'active',
          department: 'Engineering',
          title: 'CTO',
          joined_at: '2024-01-02',
          invited_at: null,
          user: { id: mockAdminId, email: 'admin@example.com' },
        },
        {
          id: '3',
          role: 'member',
          status: 'active',
          department: null,
          title: null,
          joined_at: '2024-01-03',
          invited_at: null,
          user: { id: mockMemberId, email: 'member@example.com' },
        },
        {
          id: '4',
          role: 'viewer',
          status: 'active',
          department: null,
          title: null,
          joined_at: '2024-01-04',
          invited_at: null,
          user: { id: mockViewerId, email: 'viewer@example.com' },
        },
      ]

      const fromMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        data: mockMembers,
        error: null,
      }
      
      // Make order() chainable and resolve at the end
      fromMock.order.mockImplementation(() => {
        // Return a promise-like object on the second call
        if (fromMock.order.mock.calls.length >= 2) {
          return Promise.resolve({ data: fromMock.data, error: fromMock.error })
        }
        return fromMock
      })

      // Mock two separate from calls
      mockSupabase.from
        .mockReturnValueOnce(fromMock) // organization_users
        .mockReturnValueOnce({ // invitation_tokens
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        })

      // Act
      const result = await getTeamMembers(mockOrganizationId)

      // Assert - should only have active members since invitations returned empty
      expect(result).toHaveLength(4)
      expect(result[0].user?.email).toBe('owner@example.com')
      expect(result[1].user?.email).toBe('admin@example.com')
      expect(result[2].user?.email).toBe('member@example.com')
      expect(result[3].user?.email).toBe('viewer@example.com')
      
      // Verify the query was made correctly
      expect(mockSupabase.from).toHaveBeenCalledWith('organization_users')
      expect(fromMock.eq).toHaveBeenCalledWith('organization_id', mockOrganizationId)
      expect(fromMock.neq).toHaveBeenCalledWith('status', 'pending_invitation')
    })

    it('should only show pending invitations to admins and owners', async () => {
      // Test as admin
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockAdminId } },
      })

      const mockInvitations = [
        {
          id: 'inv-1',
          email: 'pending@example.com',
          role: 'member',
          created_at: '2024-01-05',
          expires_at: '2024-02-05',
          accepted_at: null,
        },
      ]

      const fromMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        _table: '',
        _orderCalls: 0,
      }
      
      fromMock.order.mockImplementation(function() {
        fromMock._orderCalls++
        // Return promise on second order() call or for invitation_tokens
        if (fromMock._orderCalls >= 2 || fromMock._table === 'invitation_tokens') {
          if (fromMock._table === 'organization_users') {
            return Promise.resolve({ data: [], error: null })
          } else if (fromMock._table === 'invitation_tokens') {
            return Promise.resolve({ data: mockInvitations, error: null })
          }
          return Promise.resolve({ data: null, error: null })
        }
        return fromMock
      })

      mockSupabase.from.mockImplementation((table: string) => {
        fromMock._table = table
        fromMock._orderCalls = 0
        return fromMock
      })

      // Act
      const result = await getTeamMembers(mockOrganizationId)

      // Assert
      const pendingMembers = result.filter(m => m.status === 'pending_invitation')
      expect(pendingMembers).toHaveLength(1)
      expect(pendingMembers[0].user?.email).toBe('pending@example.com')
    })

    it('should not show pending invitations to regular members', async () => {
      // Test as member (not admin)
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockMemberId } },
      })

      const fromMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        _table: '',
        _orderCalls: 0,
      }
      
      fromMock.order.mockImplementation(function() {
        fromMock._orderCalls++
        if (fromMock._orderCalls >= 2 || fromMock._table === 'invitation_tokens') {
          if (fromMock._table === 'organization_users') {
            return Promise.resolve({ data: [], error: null })
          } else if (fromMock._table === 'invitation_tokens') {
            // RLS should block this for non-admins
            return Promise.resolve({ data: [], error: null })
          }
          return Promise.resolve({ data: null, error: null })
        }
        return fromMock
      })

      mockSupabase.from.mockImplementation((table: string) => {
        fromMock._table = table
        fromMock._orderCalls = 0
        return fromMock
      })

      // Act
      const result = await getTeamMembers(mockOrganizationId)

      // Assert
      const pendingMembers = result.filter(m => m.status === 'pending_invitation')
      expect(pendingMembers).toHaveLength(0)
    })

    it('should handle errors gracefully', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockMemberId } },
      })

      const fromMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        _orderCalls: 0,
      }
      
      fromMock.order.mockImplementation(() => {
        fromMock._orderCalls++
        if (fromMock._orderCalls >= 2) {
          return Promise.resolve({ 
            data: null, 
            error: new Error('Database error') 
          })
        }
        return fromMock
      })

      mockSupabase.from.mockReturnValue(fromMock)

      // Act & Assert
      await expect(getTeamMembers(mockOrganizationId)).rejects.toThrow('Database error')
    })
  })

  describe('RLS Policy Tests', () => {
    it('should enforce that users can only see members of their own organizations', async () => {
      // This test documents the expected RLS behavior
      // In a real environment, the database would enforce this
      
      // User is member of org-123
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockMemberId } },
      })

      const mockMembersOrg1 = [
        { id: '1', user: { email: 'user1@org1.com' }, organization_id: 'org-123' },
        { id: '2', user: { email: 'user2@org1.com' }, organization_id: 'org-123' },
      ]

      const mockMembersOrg2 = [
        { id: '3', user: { email: 'user1@org2.com' }, organization_id: 'org-456' },
      ]

      const fromMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        _orderCalls: 0,
      }
      
      fromMock.order.mockImplementation(() => {
        fromMock._orderCalls++
        if (fromMock._orderCalls >= 2) {
          // Only return members from org-123
          return Promise.resolve({ 
            data: mockMembersOrg1, 
            error: null 
          })
        }
        return fromMock
      })

      // Mock both queries for first call
      mockSupabase.from
        .mockReturnValueOnce(fromMock) // organization_users
        .mockReturnValueOnce({ // invitation_tokens
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        })

      // Act
      const result = await getTeamMembers('org-123')

      // Assert
      expect(result).toHaveLength(2)
      expect(result.every(m => m.user?.email?.includes('org1'))).toBe(true)
      
      // Trying to query org-456 should return empty (enforced by RLS)
      fromMock._orderCalls = 0
      fromMock.order.mockImplementation(() => {
        fromMock._orderCalls++
        if (fromMock._orderCalls >= 2) {
          return Promise.resolve({ data: [], error: null })
        }
        return fromMock
      })
      
      // Need to mock the invitation_tokens query too
      mockSupabase.from
        .mockReturnValueOnce(fromMock) // organization_users
        .mockReturnValueOnce({ // invitation_tokens
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        })
      
      const result2 = await getTeamMembers('org-456')
      expect(result2).toHaveLength(0)
    })
  })

  describe('Role-based Invitation Visibility', () => {
    const testCases = [
      { role: 'owner', canSeeInvitations: true },
      { role: 'admin', canSeeInvitations: true },
      { role: 'member', canSeeInvitations: false },
      { role: 'viewer', canSeeInvitations: false },
    ]

    testCases.forEach(({ role, canSeeInvitations }) => {
      it(`${role} should ${canSeeInvitations ? 'see' : 'not see'} pending invitations`, async () => {
        const userId = `${role}-123`
        
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: userId } },
        })

        const mockInvitation = {
          id: 'inv-1',
          email: 'newuser@example.com',
          role: 'member',
          created_at: '2024-01-01',
          expires_at: '2024-02-01',
        }

        const fromMock = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          neq: jest.fn().mockReturnThis(),
          is: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          _table: '',
          _orderCalls: 0,
        }
        
        fromMock.order.mockImplementation(function() {
          fromMock._orderCalls++
          if (fromMock._orderCalls >= 2 || fromMock._table === 'invitation_tokens') {
            if (fromMock._table === 'organization_users') {
              return Promise.resolve({ data: [], error: null })
            } else if (fromMock._table === 'invitation_tokens') {
              // Simulate RLS: only admins/owners see invitations
              if (canSeeInvitations) {
                return Promise.resolve({ data: [mockInvitation], error: null })
              } else {
                return Promise.resolve({ data: [], error: null })
              }
            }
            return Promise.resolve({ data: null, error: null })
          }
          return fromMock
        })

        mockSupabase.from.mockImplementation((table: string) => {
          fromMock._table = table
          return fromMock
        })

        // Act
        const result = await getTeamMembers(mockOrganizationId)

        // Assert
        const pendingInvitations = result.filter(m => m.status === 'pending_invitation')
        if (canSeeInvitations) {
          expect(pendingInvitations).toHaveLength(1)
          expect(pendingInvitations[0].user?.email).toBe('newuser@example.com')
        } else {
          expect(pendingInvitations).toHaveLength(0)
        }
      })
    })
  })
})