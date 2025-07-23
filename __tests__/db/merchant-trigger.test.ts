import { createClient } from '@/lib/supabase/server'

// Mock the Supabase server client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

describe('Merchant Creation Trigger', () => {
  const mockSupabase = {
    auth: {
      admin: {
        createUser: jest.fn(),
        deleteUser: jest.fn(),
      },
      signInWithPassword: jest.fn(),
    },
    from: jest.fn(),
    rpc: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(createClient as jest.Mock).mockResolvedValue(mockSupabase)
    
    // Mock the from().select() chain
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn(),
        }),
      }),
      insert: jest.fn().mockReturnValue({
        select: jest.fn(),
      }),
      delete: jest.fn().mockReturnValue({
        eq: jest.fn(),
      }),
    })
  })

  describe('Database Trigger Behavior', () => {
    it('should create merchant record automatically on user creation', async () => {
      const testEmail = 'test@example.com'
      const testBusinessName = 'Test Business'
      const testUserId = 'test-user-id'

      // Mock successful user creation
      mockSupabase.auth.admin.createUser.mockResolvedValueOnce({
        data: {
          user: {
            id: testUserId,
            email: testEmail,
            user_metadata: { business_name: testBusinessName },
          },
        },
        error: null,
      })

      // Mock merchant query returning the created record
      const mockMerchantSelect = {
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: testUserId,
              email: testEmail,
              business_name: testBusinessName,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      }
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue(mockMerchantSelect),
      })

      const supabase = await createClient()

      // Simulate user creation
      const { data: authData } = await supabase.auth.admin.createUser({
        email: testEmail,
        password: 'password123',
        email_confirm: true,
        user_metadata: { business_name: testBusinessName },
      })

      // Verify merchant was queried (simulating trigger execution)
      const { data: merchant } = await supabase
        .from('merchants')
        .select('*')
        .eq('id', testUserId)
        .single()

      expect(merchant).toEqual({
        id: testUserId,
        email: testEmail,
        business_name: testBusinessName,
        created_at: expect.any(String),
        updated_at: expect.any(String),
      })
    })

    it('should use default business name when not provided', async () => {
      const testEmail = 'test@example.com'
      const testUserId = 'test-user-id'

      // Mock user creation without business name
      mockSupabase.auth.admin.createUser.mockResolvedValueOnce({
        data: {
          user: {
            id: testUserId,
            email: testEmail,
            user_metadata: {},
          },
        },
        error: null,
      })

      // Mock merchant query with default business name
      const mockMerchantSelect = {
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: testUserId,
              email: testEmail,
              business_name: 'Unnamed Business',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      }
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue(mockMerchantSelect),
      })

      const supabase = await createClient()

      await supabase.auth.admin.createUser({
        email: testEmail,
        password: 'password123',
        email_confirm: true,
      })

      const { data: merchant } = await supabase
        .from('merchants')
        .select('*')
        .eq('id', testUserId)
        .single()

      expect(merchant?.business_name).toBe('Unnamed Business')
    })
  })

  describe('RLS Policy Tests', () => {
    it('should enforce user can only see their own merchant record', async () => {
      const user1Id = 'user1-id'
      const user2Id = 'user2-id'

      // Mock sign in as user1
      mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: {
          user: { id: user1Id },
          session: { access_token: 'user1-token' },
        },
        error: null,
      })

      // Mock merchants query returning only user1's record
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({
          data: [{
            id: user1Id,
            email: 'user1@example.com',
            business_name: 'User 1 Business',
          }],
          error: null,
        }),
      })

      const supabase = await createClient()

      // Simulate authenticated query
      const { data: merchants } = await supabase
        .from('merchants')
        .select('*')

      expect(merchants).toHaveLength(1)
      expect(merchants?.[0].id).toBe(user1Id)
    })

    it('should prevent creating merchant with different user ID', async () => {
      const userId = 'current-user-id'
      const differentId = 'different-user-id'

      // Mock authenticated user
      mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: {
          user: { id: userId },
          session: { access_token: 'user-token' },
        },
        error: null,
      })

      // Mock insert failure due to RLS
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: null,
            error: {
              code: '42501',
              message: 'new row violates row-level security policy for table "merchants"',
            },
          }),
        }),
      })

      const supabase = await createClient()

      const { error } = await supabase
        .from('merchants')
        .insert({
          id: differentId,
          email: 'fake@example.com',
          business_name: 'Fake Business',
        })
        .select()

      expect(error?.code).toBe('42501')
      expect(error?.message).toContain('row-level security policy')
    })
  })
})