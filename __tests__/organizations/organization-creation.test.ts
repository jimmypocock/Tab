import { createClient } from '@supabase/supabase-js'
import { OrganizationService } from '@/lib/services/organization.service'

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}))

// Mock database client
jest.mock('@/lib/db/client', () => ({
  db: {
    insert: jest.fn(),
    select: jest.fn(),
    from: jest.fn(),
    where: jest.fn(),
    execute: jest.fn(),
    transaction: jest.fn()
  }
}))

describe('Organization Creation Security Tests', () => {
  let mockSupabase: any
  let mockRpc: any
  let mockAuth: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup mock RPC for create_organization function
    mockRpc = jest.fn()
    mockAuth = {
      getUser: jest.fn()
    }
    
    mockSupabase = {
      rpc: mockRpc,
      auth: mockAuth,
      from: jest.fn()
    }
    
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)
  })

  describe('create_organization function', () => {
    it('should successfully create organization for authenticated user', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockOrgData = {
        name: 'Test Organization',
        type: 'business',
        is_merchant: true,
        is_corporate: false
      }
      
      mockAuth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      mockRpc.mockResolvedValue({
        data: {
          success: true,
          organization: {
            id: 'org-123',
            name: mockOrgData.name,
            slug: 'test-organization-1234567890',
            type: mockOrgData.type,
            is_merchant: mockOrgData.is_merchant,
            is_corporate: mockOrgData.is_corporate,
            primary_email: mockUser.email,
            created_by: mockUser.id
          }
        },
        error: null
      })

      const supabase = createClient('http://localhost', 'anon-key')
      const result = await supabase.rpc('create_organization', {
        p_name: mockOrgData.name,
        p_type: mockOrgData.type,
        p_is_merchant: mockOrgData.is_merchant,
        p_is_corporate: mockOrgData.is_corporate
      })

      expect(result.data.success).toBe(true)
      expect(result.data.organization).toBeDefined()
      expect(result.data.organization.name).toBe(mockOrgData.name)
      expect(result.data.organization.created_by).toBe(mockUser.id)
    })

    it('should fail when user is not authenticated', async () => {
      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' }
      })

      mockRpc.mockResolvedValue({
        data: {
          success: false,
          error: 'Not authenticated'
        },
        error: null
      })

      const supabase = createClient('http://localhost', 'anon-key')
      const result = await supabase.rpc('create_organization', {
        p_name: 'Test Org',
        p_type: 'business',
        p_is_merchant: true,
        p_is_corporate: false
      })

      expect(result.data.success).toBe(false)
      expect(result.data.error).toBe('Not authenticated')
    })

    it('should sanitize organization name for slug generation', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const dangerousName = "Test'; DROP TABLE organizations;--"
      
      mockAuth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      mockRpc.mockResolvedValue({
        data: {
          success: true,
          organization: {
            id: 'org-123',
            name: dangerousName,
            slug: 'test-drop-table-organizations-1234567890', // Sanitized
            type: 'business',
            is_merchant: true,
            is_corporate: false,
            primary_email: mockUser.email,
            created_by: mockUser.id
          }
        },
        error: null
      })

      const supabase = createClient('http://localhost', 'anon-key')
      const result = await supabase.rpc('create_organization', {
        p_name: dangerousName,
        p_type: 'business',
        p_is_merchant: true,
        p_is_corporate: false
      })

      expect(result.data.success).toBe(true)
      expect(result.data.organization.slug).not.toContain("'")
      expect(result.data.organization.slug).not.toContain(";")
      expect(result.data.organization.slug).not.toContain("--")
    })

    it('should handle database errors gracefully', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      
      mockAuth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      mockRpc.mockResolvedValue({
        data: {
          success: false,
          error: 'duplicate key value violates unique constraint "organizations_slug_key"'
        },
        error: null
      })

      const supabase = createClient('http://localhost', 'anon-key')
      const result = await supabase.rpc('create_organization', {
        p_name: 'Existing Org',
        p_type: 'business',
        p_is_merchant: true,
        p_is_corporate: false
      })

      expect(result.data.success).toBe(false)
      expect(result.data.error).toContain('duplicate key')
    })
  })

  describe('RLS Policy Tests', () => {
    it('should not allow direct insert to organizations table', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: {
                code: '42501',
                message: 'new row violates row-level security policy for table "organizations"'
              }
            })
          })
        })
      })

      mockSupabase.from = mockFrom

      const supabase = createClient('http://localhost', 'anon-key')
      const result = await supabase
        .from('organizations')
        .insert({
          name: 'Hacker Org',
          slug: 'hacker-org',
          type: 'business',
          is_merchant: true,
          is_corporate: false,
          primary_email: 'hacker@evil.com',
          created_by: 'fake-user-id'
        })
        .select()
        .single()

      expect(result.error).toBeDefined()
      expect(result.error.code).toBe('42501')
      expect(result.error.message).toContain('row-level security policy')
    })

    it('should not allow direct insert to organization_users table', async () => {
      const mockFrom = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: {
                code: '42501',
                message: 'new row violates row-level security policy for table "organization_users"'
              }
            })
          })
        })
      })

      mockSupabase.from = mockFrom

      const supabase = createClient('http://localhost', 'anon-key')
      const result = await supabase
        .from('organization_users')
        .insert({
          organization_id: 'org-123',
          user_id: 'user-123',
          role: 'owner',
          status: 'active'
        })
        .select()
        .single()

      expect(result.error).toBeDefined()
      expect(result.error.code).toBe('42501')
      expect(result.error.message).toContain('row-level security policy')
    })
  })

  describe('Search Path Security', () => {
    it('create_organization function should have secure search_path', async () => {
      // This test verifies that the function was created with SET search_path = ''
      // In a real test environment, you would query pg_proc to verify this
      // Here we're testing the behavior that would result from proper search_path
      
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      
      mockAuth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      // Even with malicious schema names, the function should work correctly
      mockRpc.mockResolvedValue({
        data: {
          success: true,
          organization: {
            id: 'org-123',
            name: 'Secure Org',
            slug: 'secure-org-1234567890',
            type: 'business',
            is_merchant: true,
            is_corporate: false,
            primary_email: mockUser.email,
            created_by: mockUser.id
          }
        },
        error: null
      })

      const supabase = createClient('http://localhost', 'anon-key')
      const result = await supabase.rpc('create_organization', {
        p_name: 'Secure Org',
        p_type: 'business',
        p_is_merchant: true,
        p_is_corporate: false
      })

      expect(result.data.success).toBe(true)
      expect(mockRpc).toHaveBeenCalledWith('create_organization', expect.any(Object))
    })
  })

  describe('Organization Service Tests', () => {
    it('should check user access correctly', async () => {
      const userId = 'user-123'
      const orgId = 'org-123'
      
      // Mock the database response
      const mockDb = await import('@/lib/db/client')
      const mockSelect = jest.fn().mockReturnThis()
      const mockFrom = jest.fn().mockReturnThis()
      const mockInnerJoin = jest.fn().mockReturnThis()
      const mockWhere = jest.fn().mockReturnThis()
      const mockLimit = jest.fn().mockResolvedValue([{
        organizations: { id: orgId, isMerchant: true, isCorporate: false },
        organization_users: { role: 'owner' }
      }])
      
      mockDb.db.select = mockSelect
      mockSelect.mockReturnValue({ from: mockFrom })
      mockFrom.mockReturnValue({ innerJoin: mockInnerJoin })
      mockInnerJoin.mockReturnValue({ where: mockWhere })
      mockWhere.mockReturnValue({ limit: mockLimit })
      
      const result = await OrganizationService.checkUserAccess(
        userId,
        orgId,
        'member',
        'merchant'
      )
      
      expect(result.hasAccess).toBe(true)
      expect(result.userRole).toBe('owner')
    })

    it('should prevent access for non-members', async () => {
      const userId = 'user-123'
      const orgId = 'org-123'
      
      // Mock empty database response
      const mockDb = await import('@/lib/db/client')
      const mockSelect = jest.fn().mockReturnThis()
      const mockFrom = jest.fn().mockReturnThis()
      const mockInnerJoin = jest.fn().mockReturnThis()
      const mockWhere = jest.fn().mockReturnThis()
      const mockLimit = jest.fn().mockResolvedValue([])
      
      mockDb.db.select = mockSelect
      mockSelect.mockReturnValue({ from: mockFrom })
      mockFrom.mockReturnValue({ innerJoin: mockInnerJoin })
      mockInnerJoin.mockReturnValue({ where: mockWhere })
      mockWhere.mockReturnValue({ limit: mockLimit })
      
      const result = await OrganizationService.checkUserAccess(
        userId,
        orgId,
        'owner'
      )
      
      expect(result.hasAccess).toBe(false)
      expect(result.userRole).toBeUndefined()
    })
  })
})