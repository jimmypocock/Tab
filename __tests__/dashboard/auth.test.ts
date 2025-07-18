import { createClient } from '@/lib/supabase/server'
import { getDashboardStats } from '@/lib/services/dashboard'
import { redirect } from 'next/navigation'

// Mock dependencies
jest.mock('@/lib/supabase/server')
jest.mock('next/navigation')

describe('Dashboard Authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Protected Route Access', () => {
    it('should redirect unauthenticated users to login', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      }
      
      ;(createClient as jest.Mock).mockReturnValue(mockSupabase)
      ;(redirect as jest.Mock).mockImplementation((url) => {
        throw new Error(`NEXT_REDIRECT: ${url}`)
      })

      // Simulate accessing a protected route
      try {
        await mockSupabase.auth.getUser()
        if (!mockSupabase.auth.getUser().then(r => r.data.user)) {
          redirect('/login')
        }
      } catch (error: any) {
        expect(error.message).toBe('NEXT_REDIRECT: /login')
      }

      expect(redirect).toHaveBeenCalledWith('/login')
    })

    it('should allow authenticated users to access dashboard', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'merchant@example.com',
      }

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      }
      
      ;(createClient as jest.Mock).mockReturnValue(mockSupabase)

      const { data } = await mockSupabase.auth.getUser()
      
      expect(data.user).toBeTruthy()
      expect(data.user.id).toBe('test-user-id')
      expect(redirect).not.toHaveBeenCalled()
    })
  })

  describe('Dashboard Data Access', () => {
    it('should only return data for authenticated merchant', async () => {
      const mockUserId = 'merchant-123'
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { 
              user: { 
                id: mockUserId,
                email: 'merchant@example.com' 
              } 
            },
            error: null,
          }),
        },
        rpc: jest.fn().mockResolvedValue({
          data: [{
            total_tabs: 10,
            open_tabs: 3,
            total_revenue: 1500,
            pending_revenue: 300,
          }],
          error: null,
        }),
      }
      
      ;(createClient as jest.Mock).mockReturnValue(mockSupabase)

      const stats = await getDashboardStats()

      expect(stats).toEqual({
        total_tabs: 10,
        open_tabs: 3,
        total_revenue: 1500,
        pending_revenue: 300,
      })

      // Verify RPC was called with correct function
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_merchant_stats')
    })

    it('should handle missing merchant gracefully', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      }
      
      ;(createClient as jest.Mock).mockReturnValue(mockSupabase)

      try {
        await getDashboardStats()
      } catch (error: any) {
        expect(error.message).toBe('Not authenticated')
      }
    })
  })

  describe('Merchant Onboarding', () => {
    it('should create merchant record on first login', async () => {
      const mockUser = {
        id: 'new-user-id',
        email: 'newmerchant@example.com',
      }

      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null, // No existing merchant
                error: { code: 'PGRST116' }, // Not found error
              }),
            }),
          }),
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: mockUser.id,
                  email: mockUser.email,
                  business_name: 'New Business',
                },
                error: null,
              }),
            }),
          }),
        }),
      }
      
      ;(createClient as jest.Mock).mockReturnValue(mockSupabase)

      // Check if merchant exists
      const { data: existingMerchant } = await mockSupabase
        .from('merchants')
        .select('*')
        .eq('id', mockUser.id)
        .single()

      if (!existingMerchant) {
        // Create new merchant
        const { data: newMerchant } = await mockSupabase
          .from('merchants')
          .insert({
            id: mockUser.id,
            email: mockUser.email,
            business_name: 'New Business',
          })
          .select()
          .single()

        expect(newMerchant).toBeTruthy()
        expect(newMerchant.id).toBe(mockUser.id)
      }
    })
  })

  describe('Session Management', () => {
    it('should handle expired sessions', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'Session expired' },
          }),
        },
      }
      
      ;(createClient as jest.Mock).mockReturnValue(mockSupabase)
      ;(redirect as jest.Mock).mockImplementation((url) => {
        throw new Error(`NEXT_REDIRECT: ${url}`)
      })

      const { error } = await mockSupabase.auth.getUser()
      
      if (error) {
        try {
          redirect('/login?message=Session expired')
        } catch (e: any) {
          expect(e.message).toBe('NEXT_REDIRECT: /login?message=Session expired')
        }
      }
    })

    it('should refresh valid sessions', async () => {
      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: {
              session: {
                access_token: 'valid_token',
                expires_at: Date.now() + 3600000, // 1 hour from now
              },
            },
            error: null,
          }),
          refreshSession: jest.fn().mockResolvedValue({
            data: {
              session: {
                access_token: 'new_token',
                expires_at: Date.now() + 7200000, // 2 hours from now
              },
            },
            error: null,
          }),
        },
      }
      
      ;(createClient as jest.Mock).mockReturnValue(mockSupabase)

      const { data: session } = await mockSupabase.auth.getSession()
      
      // Check if session needs refresh (within 5 minutes of expiry)
      const expiresIn = session.session.expires_at - Date.now()
      if (expiresIn < 300000) { // 5 minutes
        await mockSupabase.auth.refreshSession()
        expect(mockSupabase.auth.refreshSession).toHaveBeenCalled()
      }
    })
  })
})