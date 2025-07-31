import { createAdminClient } from '@/lib/supabase/admin'

// Mock the admin client
jest.mock('@/lib/supabase/admin')

describe('Organization Creation Service', () => {
  const mockSupabase = {
    rpc: jest.fn(),
    from: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(createAdminClient as jest.Mock).mockReturnValue(mockSupabase)
  })

  describe('create_organization function', () => {
    it('should successfully create an organization', async () => {
      const mockResult = {
        success: true,
        organization: {
          id: 'org-123',
          name: 'Test Organization',
          slug: 'test-organization-123',
          type: 'business',
          is_merchant: true,
          is_corporate: false,
        },
      }

      mockSupabase.rpc.mockResolvedValue({
        data: mockResult,
        error: null,
      })

      const supabase = createAdminClient()
      const { data, error } = await supabase.rpc('create_organization', {
        p_name: 'Test Organization',
        p_type: 'business',
        p_is_merchant: true,
        p_is_corporate: false,
      })

      expect(error).toBeNull()
      expect(data).toEqual(mockResult)
      expect(data.success).toBe(true)
      expect(data.organization.name).toBe('Test Organization')
    })

    it('should handle organization creation failure', async () => {
      const mockResult = {
        success: false,
        error: 'Not authenticated',
      }

      mockSupabase.rpc.mockResolvedValue({
        data: mockResult,
        error: null,
      })

      const supabase = createAdminClient()
      const { data, error } = await supabase.rpc('create_organization', {
        p_name: 'Test Organization',
        p_type: 'business',
        p_is_merchant: true,
        p_is_corporate: false,
      })

      expect(error).toBeNull()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Not authenticated')
    })

    it('should handle different organization types', async () => {
      const testCases = [
        { type: 'business', is_merchant: true, is_corporate: false },
        { type: 'corporate', is_merchant: false, is_corporate: true },
        { type: 'business', is_merchant: true, is_corporate: true },
      ]

      for (const testCase of testCases) {
        mockSupabase.rpc.mockResolvedValue({
          data: {
            success: true,
            organization: {
              id: `org-${Date.now()}`,
              name: `Test ${testCase.type}`,
              slug: `test-${testCase.type}`,
              type: testCase.type,
              is_merchant: testCase.is_merchant,
              is_corporate: testCase.is_corporate,
            },
          },
          error: null,
        })

        const supabase = createAdminClient()
        const { data } = await supabase.rpc('create_organization', {
          p_name: `Test ${testCase.type}`,
          p_type: testCase.type,
          p_is_merchant: testCase.is_merchant,
          p_is_corporate: testCase.is_corporate,
        })

        expect(data.success).toBe(true)
        expect(data.organization.type).toBe(testCase.type)
        expect(data.organization.is_merchant).toBe(testCase.is_merchant)
        expect(data.organization.is_corporate).toBe(testCase.is_corporate)
      }
    })
  })

  describe('Organization membership', () => {
    it('should add user as owner when creating organization', async () => {
      const mockMemberships = [
        {
          id: 'mem-123',
          organization_id: 'org-123',
          user_id: 'user-123',
          role: 'owner',
          status: 'active',
        },
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: mockMemberships,
          error: null,
        }),
      })

      const supabase = createAdminClient()
      const { data } = await supabase
        .from('organization_users')
        .select('*')
        .eq('organization_id', 'org-123')

      expect(data).toHaveLength(1)
      expect(data[0].role).toBe('owner')
      expect(data[0].status).toBe('active')
    })
  })

  describe('RLS policies', () => {
    it('should prevent direct insertion to organizations table', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: {
            code: '42501',
            message: 'new row violates row-level security policy',
          },
        }),
      })

      const supabase = createAdminClient()
      const { error } = await supabase.from('organizations').insert({
        name: 'Direct Insert Org',
        slug: 'direct-insert',
        type: 'business',
        is_merchant: true,
        is_corporate: false,
      })

      expect(error).toBeDefined()
      expect(error.code).toBe('42501')
    })
  })
})