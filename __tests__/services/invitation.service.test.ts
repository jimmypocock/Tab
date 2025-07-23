import { InvitationService } from '@/lib/services/invitation.service'
import { createAdminClient } from '@/lib/supabase/admin'

// Mock the Supabase admin client
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn()
}))

// Mock Resend
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn()
    }
  }))
}))

describe('InvitationService', () => {
  let mockSupabase: any

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      rpc: jest.fn()
    }
    
    ;(createAdminClient as jest.MockedFunction<typeof createAdminClient>).mockReturnValue(mockSupabase)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('generateToken', () => {
    it('should generate a 64-character hex token', () => {
      const token = InvitationService.generateToken()
      
      expect(token).toHaveLength(64)
      expect(token).toMatch(/^[a-f0-9]{64}$/)
    })

    it('should generate unique tokens', () => {
      const token1 = InvitationService.generateToken()
      const token2 = InvitationService.generateToken()
      
      expect(token1).not.toBe(token2)
    })
  })

  describe('createInvitation', () => {
    it('should create an invitation with default expiry', async () => {
      const mockInvitation = {
        id: 'inv-123',
        token: 'test-token',
        email: 'test@example.com',
        role: 'member',
        organization_id: 'org-123'
      }
      
      mockSupabase.single.mockResolvedValue({
        data: mockInvitation,
        error: null
      })

      const result = await InvitationService.createInvitation({
        organizationId: 'org-123',
        email: 'test@example.com',
        role: 'member',
        invitedBy: 'user-123'
      })

      expect(mockSupabase.from).toHaveBeenCalledWith('invitation_tokens')
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        organization_id: 'org-123',
        email: 'test@example.com',
        role: 'member',
        invited_by: 'user-123',
        token: expect.any(String),
        expires_at: expect.any(String),
        department: undefined,
        title: undefined,
        custom_message: undefined
      })
      expect(result.invitation).toEqual(mockInvitation)
      expect(result.token).toBeDefined()
    })

    it('should create an invitation with custom expiry and metadata', async () => {
      const mockInvitation = {
        id: 'inv-123',
        token: 'test-token',
        email: 'test@example.com',
        role: 'admin',
        organization_id: 'org-123',
        department: 'Engineering',
        title: 'Senior Developer'
      }
      
      mockSupabase.single.mockResolvedValue({
        data: mockInvitation,
        error: null
      })

      const result = await InvitationService.createInvitation({
        organizationId: 'org-123',
        email: 'test@example.com',
        role: 'admin',
        invitedBy: 'user-123',
        department: 'Engineering',
        title: 'Senior Developer',
        customMessage: 'Welcome to the team!',
        expiresInDays: 14
      })

      expect(mockSupabase.insert).toHaveBeenCalledWith({
        organization_id: 'org-123',
        email: 'test@example.com',
        role: 'admin',
        invited_by: 'user-123',
        token: expect.any(String),
        expires_at: expect.any(String),
        department: 'Engineering',
        title: 'Senior Developer',
        custom_message: 'Welcome to the team!'
      })
      expect(result.invitation).toEqual(mockInvitation)
    })

    it('should throw error when database insertion fails', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: new Error('Database error')
      })

      await expect(
        InvitationService.createInvitation({
          organizationId: 'org-123',
          email: 'test@example.com',
          role: 'member',
          invitedBy: 'user-123'
        })
      ).rejects.toThrow('Database error')
    })
  })

  describe('acceptInvitation', () => {
    it('should successfully accept a valid invitation', async () => {
      const mockResult = {
        success: true,
        organization_id: 'org-123',
        role: 'member',
        error_message: null
      }
      
      mockSupabase.rpc.mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: mockResult,
          error: null
        })
      })

      const result = await InvitationService.acceptInvitation('test-token', 'user-123')

      expect(mockSupabase.rpc).toHaveBeenCalledWith('accept_invitation', {
        p_token: 'test-token',
        p_user_id: 'user-123'
      })
      expect(result).toEqual(mockResult)
    })

    it('should throw error when acceptance fails', async () => {
      mockSupabase.rpc.mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Invalid token')
        })
      })

      await expect(
        InvitationService.acceptInvitation('invalid-token', 'user-123')
      ).rejects.toThrow('Invalid token')
    })
  })

  describe('getPendingInvitations', () => {
    it('should fetch pending invitations for an organization', async () => {
      const mockInvitations = [
        {
          id: 'inv-1',
          email: 'user1@example.com',
          role: 'member',
          status: 'pending'
        },
        {
          id: 'inv-2',
          email: 'user2@example.com',
          role: 'admin',
          status: 'pending'
        }
      ]
      
      mockSupabase.order.mockResolvedValue({
        data: mockInvitations,
        error: null
      })

      const result = await InvitationService.getPendingInvitations('org-123')

      expect(mockSupabase.from).toHaveBeenCalledWith('pending_invitations')
      expect(mockSupabase.eq).toHaveBeenCalledWith('organization_id', 'org-123')
      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'pending')
      expect(mockSupabase.order).toHaveBeenCalledWith('created_at', { ascending: false })
      expect(result).toEqual(mockInvitations)
    })
  })

  describe('cancelInvitation', () => {
    it('should successfully cancel an invitation', async () => {
      mockSupabase.is.mockResolvedValue({
        data: null,
        error: null
      })

      const result = await InvitationService.cancelInvitation('inv-123')

      expect(mockSupabase.from).toHaveBeenCalledWith('invitation_tokens')
      expect(mockSupabase.delete).toHaveBeenCalled()
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'inv-123')
      expect(mockSupabase.is).toHaveBeenCalledWith('accepted_at', null)
      expect(result).toEqual({ success: true })
    })

    it('should throw error when cancellation fails', async () => {
      mockSupabase.is.mockResolvedValue({
        data: null,
        error: new Error('Not found')
      })

      await expect(
        InvitationService.cancelInvitation('inv-123')
      ).rejects.toThrow('Not found')
    })
  })

  describe('cleanupExpiredInvitations', () => {
    it('should successfully cleanup expired invitations', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: null
      })

      const result = await InvitationService.cleanupExpiredInvitations()

      expect(mockSupabase.rpc).toHaveBeenCalledWith('cleanup_expired_invitations')
      expect(result).toEqual({ success: true })
    })

    it('should throw error when cleanup fails', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: new Error('Cleanup failed')
      })

      await expect(
        InvitationService.cleanupExpiredInvitations()
      ).rejects.toThrow('Cleanup failed')
    })
  })

  describe('sendInvitationEmail', () => {
    it('should return mock success when email service is not configured', async () => {
      // Temporarily remove RESEND_API_KEY
      const originalEnv = process.env.RESEND_API_KEY
      delete process.env.RESEND_API_KEY

      const result = await InvitationService.sendInvitationEmail({
        email: 'test@example.com',
        inviterName: 'John Doe',
        organizationName: 'Acme Corp',
        token: 'test-token'
      })

      expect(result).toEqual({ success: true, mockMode: true })

      // Restore env
      if (originalEnv) process.env.RESEND_API_KEY = originalEnv
    })
  })
})