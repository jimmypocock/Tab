/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Mock dependencies
const mockDb = {
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  query: {
    organizations: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    organizationUsers: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    users: {
      findFirst: jest.fn(),
    },
    organizationInvites: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
  transaction: jest.fn(),
}

// Mock email service  
const mockEmailService = {
  sendOrganizationInvite: jest.fn(),
  sendWelcomeToOrganization: jest.fn(),
}

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}

// Organization service under test
class OrganizationService {
  constructor(
    private db: any,
    private emailService: any,
    private logger: any
  ) {}

  async createOrganization(
    userId: string,
    data: {
      name: string
      slug: string
      type: 'merchant' | 'corporate'
      metadata?: Record<string, any>
    }
  ) {
    try {
      // Check if slug is unique
      const existing = await this.db.query.organizations.findFirst({
        where: { slug: data.slug }
      })

      if (existing) {
        throw new Error('Organization slug already exists')
      }

      // Create organization and add user as owner
      const result = await this.db.transaction(async (trx) => {
        // Create organization
        const org = await trx.insert('organizations').values({
          name: data.name,
          slug: data.slug,
          type: data.type,
          isMerchant: data.type === 'merchant',
          isCorporate: data.type === 'corporate',
          metadata: data.metadata || {},
          createdBy: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        }).returning()

        // Add user as owner
        await trx.insert('organization_users').values({
          organizationId: org[0].id,
          userId,
          role: 'owner',
          joinedAt: new Date(),
          createdAt: new Date(),
        })

        return org[0]
      })

      this.logger.info(`Created organization ${result.slug} for user ${userId}`)

      return result
    } catch (error) {
      this.logger.error(`Failed to create organization: ${error.message}`)
      throw error
    }
  }

  async updateOrganization(
    organizationId: string,
    userId: string,
    updates: {
      name?: string
      metadata?: Record<string, any>
      settings?: Record<string, any>
    }
  ) {
    try {
      // Check user has permission
      const membership = await this.db.query.organizationUsers.findFirst({
        where: { 
          organizationId,
          userId,
          role: { in: ['owner', 'admin'] }
        }
      })

      if (!membership) {
        throw new Error('Insufficient permissions')
      }

      const updated = await this.db.update('organizations')
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where({ id: organizationId })
        .returning()

      this.logger.info(`Updated organization ${organizationId}`)

      return updated[0]
    } catch (error) {
      this.logger.error(`Failed to update organization: ${error.message}`)
      throw error
    }
  }

  async inviteUser(
    organizationId: string,
    invitedBy: string,
    data: {
      email: string
      role: 'admin' | 'member'
    }
  ) {
    try {
      // Check inviter has permission
      const inviterMembership = await this.db.query.organizationUsers.findFirst({
        where: { 
          organizationId,
          userId: invitedBy,
          role: { in: ['owner', 'admin'] }
        }
      })

      if (!inviterMembership) {
        throw new Error('Insufficient permissions to invite users')
      }

      // Check if user already in organization
      const existingUser = await this.db.query.users.findFirst({
        where: { email: data.email }
      })

      if (existingUser) {
        const existingMembership = await this.db.query.organizationUsers.findFirst({
          where: {
            organizationId,
            userId: existingUser.id
          }
        })

        if (existingMembership) {
          throw new Error('User already in organization')
        }
      }

      // Check for existing invite
      const existingInvite = await this.db.query.organizationInvites.findFirst({
        where: {
          organizationId,
          email: data.email,
          status: 'pending'
        }
      })

      if (existingInvite) {
        throw new Error('Invite already sent to this email')
      }

      // Create invite
      const inviteToken = this.generateInviteToken()
      
      const invite = await this.db.insert('organization_invites').values({
        organizationId,
        email: data.email,
        role: data.role,
        invitedBy,
        token: inviteToken,
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        createdAt: new Date(),
      }).returning()

      // Get organization for email
      const organization = await this.db.query.organizations.findFirst({
        where: { id: organizationId }
      })

      // Send invite email
      await this.emailService.sendOrganizationInvite({
        to: data.email,
        organization,
        inviteToken,
        role: data.role,
      })

      this.logger.info(`Sent invite to ${data.email} for organization ${organizationId}`)

      return invite[0]
    } catch (error) {
      this.logger.error(`Failed to invite user: ${error.message}`)
      throw error
    }
  }

  async acceptInvite(token: string, userId: string) {
    try {
      // Get invite
      const invite = await this.db.query.organizationInvites.findFirst({
        where: { 
          token,
          status: 'pending'
        }
      })

      if (!invite) {
        throw new Error('Invalid or expired invite')
      }

      if (new Date() > invite.expiresAt) {
        throw new Error('Invite has expired')
      }

      // Get user
      const user = await this.db.query.users.findFirst({
        where: { id: userId }
      })

      if (!user || user.email !== invite.email) {
        throw new Error('Invite not for this user')
      }

      // Accept invite in transaction
      const result = await this.db.transaction(async (trx) => {
        // Add user to organization
        await trx.insert('organization_users').values({
          organizationId: invite.organizationId,
          userId,
          role: invite.role,
          joinedAt: new Date(),
          createdAt: new Date(),
        })

        // Update invite status
        await trx.update('organization_invites')
          .set({
            status: 'accepted',
            acceptedAt: new Date(),
            acceptedBy: userId,
          })
          .where({ id: invite.id })

        return invite.organizationId
      })

      // Get organization for welcome email
      const organization = await this.db.query.organizations.findFirst({
        where: { id: result }
      })

      // Send welcome email
      await this.emailService.sendWelcomeToOrganization({
        to: user.email,
        organization,
        role: invite.role,
      })

      this.logger.info(`User ${userId} accepted invite to organization ${result}`)

      return result
    } catch (error) {
      this.logger.error(`Failed to accept invite: ${error.message}`)
      throw error
    }
  }

  async removeUser(
    organizationId: string,
    userIdToRemove: string,
    removedBy: string
  ) {
    try {
      // Check remover has permission
      const removerMembership = await this.db.query.organizationUsers.findFirst({
        where: { 
          organizationId,
          userId: removedBy,
          role: { in: ['owner', 'admin'] }
        }
      })

      if (!removerMembership) {
        throw new Error('Insufficient permissions')
      }

      // Get user to remove membership
      const membershipToRemove = await this.db.query.organizationUsers.findFirst({
        where: {
          organizationId,
          userId: userIdToRemove
        }
      })

      if (!membershipToRemove) {
        throw new Error('User not in organization')
      }

      // Can't remove owner
      if (membershipToRemove.role === 'owner') {
        throw new Error('Cannot remove organization owner')
      }

      // Can't remove yourself
      if (userIdToRemove === removedBy) {
        throw new Error('Cannot remove yourself')
      }

      // Remove user
      await this.db.delete('organization_users')
        .where({
          organizationId,
          userId: userIdToRemove
        })

      this.logger.info(`Removed user ${userIdToRemove} from organization ${organizationId}`)

      return true
    } catch (error) {
      this.logger.error(`Failed to remove user: ${error.message}`)
      throw error
    }
  }

  async updateUserRole(
    organizationId: string,
    userIdToUpdate: string,
    newRole: 'admin' | 'member',
    updatedBy: string
  ) {
    try {
      // Check updater has permission
      const updaterMembership = await this.db.query.organizationUsers.findFirst({
        where: { 
          organizationId,
          userId: updatedBy,
          role: 'owner'
        }
      })

      if (!updaterMembership) {
        throw new Error('Only owners can update roles')
      }

      // Get user to update
      const membershipToUpdate = await this.db.query.organizationUsers.findFirst({
        where: {
          organizationId,
          userId: userIdToUpdate
        }
      })

      if (!membershipToUpdate) {
        throw new Error('User not in organization')
      }

      // Can't change owner role
      if (membershipToUpdate.role === 'owner') {
        throw new Error('Cannot change owner role')
      }

      // Update role
      await this.db.update('organization_users')
        .set({
          role: newRole,
          updatedAt: new Date(),
        })
        .where({
          organizationId,
          userId: userIdToUpdate
        })

      this.logger.info(`Updated user ${userIdToUpdate} role to ${newRole} in organization ${organizationId}`)

      return true
    } catch (error) {
      this.logger.error(`Failed to update user role: ${error.message}`)
      throw error
    }
  }

  async getOrganizationMembers(organizationId: string, userId: string) {
    try {
      // Check user has access
      const membership = await this.db.query.organizationUsers.findFirst({
        where: {
          organizationId,
          userId
        }
      })

      if (!membership) {
        throw new Error('Not a member of this organization')
      }

      // Get all members
      const members = await this.db.query.organizationUsers.findMany({
        where: { organizationId },
        with: { user: true },
        orderBy: { joinedAt: 'asc' }
      })

      return members.map(m => ({
        id: m.user.id,
        email: m.user.email,
        role: m.role,
        joinedAt: m.joinedAt,
      }))
    } catch (error) {
      this.logger.error(`Failed to get organization members: ${error.message}`)
      throw error
    }
  }

  async getUserOrganizations(userId: string) {
    try {
      const memberships = await this.db.query.organizationUsers.findMany({
        where: { userId },
        with: { organization: true },
        orderBy: { joinedAt: 'desc' }
      })

      return memberships.map(m => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        type: m.organization.type,
        role: m.role,
        joinedAt: m.joinedAt,
      }))
    } catch (error) {
      this.logger.error(`Failed to get user organizations: ${error.message}`)
      throw error
    }
  }

  async transferOwnership(
    organizationId: string,
    newOwnerId: string,
    currentOwnerId: string
  ) {
    try {
      // Verify current owner
      const currentOwnerMembership = await this.db.query.organizationUsers.findFirst({
        where: {
          organizationId,
          userId: currentOwnerId,
          role: 'owner'
        }
      })

      if (!currentOwnerMembership) {
        throw new Error('Only current owner can transfer ownership')
      }

      // Verify new owner is member
      const newOwnerMembership = await this.db.query.organizationUsers.findFirst({
        where: {
          organizationId,
          userId: newOwnerId
        }
      })

      if (!newOwnerMembership) {
        throw new Error('New owner must be organization member')
      }

      // Transfer ownership
      await this.db.transaction(async (trx) => {
        // Update current owner to admin
        await trx.update('organization_users')
          .set({ role: 'admin' })
          .where({
            organizationId,
            userId: currentOwnerId
          })

        // Update new owner
        await trx.update('organization_users')
          .set({ role: 'owner' })
          .where({
            organizationId,
            userId: newOwnerId
          })
      })

      this.logger.info(`Transferred ownership of organization ${organizationId} from ${currentOwnerId} to ${newOwnerId}`)

      return true
    } catch (error) {
      this.logger.error(`Failed to transfer ownership: ${error.message}`)
      throw error
    }
  }

  // Private helper methods
  private generateInviteToken(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36)
  }
}

describe('OrganizationService', () => {
  let service: OrganizationService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new OrganizationService(mockDb, mockEmailService, mockLogger)
  })

  describe('createOrganization', () => {
    beforeEach(() => {
      mockDb.query.organizations.findFirst.mockResolvedValue(null)
      mockDb.transaction.mockImplementation(async (callback) => {
        return callback({
          insert: jest.fn().mockReturnValue({
            values: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([{
                id: 'org_123',
                name: 'Test Org',
                slug: 'test-org',
                type: 'merchant',
              }])
            })
          })
        })
      })
    })

    it('should create organization successfully', async () => {
      const result = await service.createOrganization('user_123', {
        name: 'Test Organization',
        slug: 'test-org',
        type: 'merchant',
      })

      expect(result).toMatchObject({
        id: 'org_123',
        name: 'Test Org',
        slug: 'test-org',
        type: 'merchant',
      })

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Created organization test-org for user user_123'
      )
    })

    it('should throw error if slug exists', async () => {
      mockDb.query.organizations.findFirst.mockResolvedValue({
        id: 'existing_org',
        slug: 'test-org'
      })

      await expect(
        service.createOrganization('user_123', {
          name: 'Test Org',
          slug: 'test-org',
          type: 'merchant',
        })
      ).rejects.toThrow('Organization slug already exists')
    })

    it('should set correct type flags', async () => {
      let capturedOrgData: any = null
      
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockTrx = {
          insert: jest.fn((tableName: string) => ({
            values: jest.fn((data: any) => {
              // Only capture organization data, not organization_users data
              if (tableName === 'organizations') {
                capturedOrgData = data
              }
              return {
                returning: jest.fn().mockResolvedValue([{
                  id: 'org_123',
                  name: 'Test Corp',
                  slug: 'test-corp',
                  type: 'corporate',
                }])
              }
            })
          }))
        }
        return callback(mockTrx)
      })
      
      await service.createOrganization('user_123', {
        name: 'Test Corp',
        slug: 'test-corp',
        type: 'corporate',
      })

      // Check the captured data
      expect(capturedOrgData).toBeTruthy()
      expect(capturedOrgData.isMerchant).toBe(false)
      expect(capturedOrgData.isCorporate).toBe(true)
      expect(capturedOrgData.type).toBe('corporate')
    })
  })

  describe('inviteUser', () => {
    const mockOrganization = {
      id: 'org_123',
      name: 'Test Org',
      slug: 'test-org',
    }

    beforeEach(() => {
      // Reset all mocks
      mockDb.query.organizationUsers.findFirst.mockReset()
      mockDb.query.users.findFirst.mockReset()
      mockDb.query.organizationInvites.findFirst.mockReset()
      mockDb.query.organizations.findFirst.mockReset()
      
      // Default mock setup
      mockDb.query.users.findFirst.mockResolvedValue(null)
      mockDb.query.organizationInvites.findFirst.mockResolvedValue(null)
      mockDb.query.organizations.findFirst.mockResolvedValue(mockOrganization)
      mockEmailService.sendOrganizationInvite.mockResolvedValue(undefined)

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{
            id: 'invite_123',
            email: 'newuser@example.com',
            role: 'member',
            token: 'invite_token_123',
          }])
        })
      })
    })

    it('should send invite successfully', async () => {
      mockDb.query.organizationUsers.findFirst
        .mockResolvedValueOnce({ role: 'owner' }) // Inviter membership
        .mockResolvedValueOnce(null) // Existing membership check
      
      const result = await service.inviteUser('org_123', 'user_123', {
        email: 'newuser@example.com',
        role: 'member',
      })

      expect(result).toMatchObject({
        email: 'newuser@example.com',
        role: 'member',
      })

      expect(mockEmailService.sendOrganizationInvite).toHaveBeenCalledWith({
        to: 'newuser@example.com',
        organization: mockOrganization,
        inviteToken: expect.any(String),
        role: 'member',
      })
    })

    it('should throw error if inviter lacks permission', async () => {
      mockDb.query.organizationUsers.findFirst
        .mockResolvedValueOnce(null) // Inviter membership - not found because role is not owner/admin

      await expect(
        service.inviteUser('org_123', 'user_123', {
          email: 'newuser@example.com',
          role: 'member',
        })
      ).rejects.toThrow('Insufficient permissions to invite users')
    })

    it('should throw error if user already in organization', async () => {
      mockDb.query.organizationUsers.findFirst
        .mockResolvedValueOnce({ role: 'owner' }) // Inviter
        .mockResolvedValueOnce({ userId: 'existing_user' }) // Existing membership
        
      mockDb.query.users.findFirst.mockResolvedValue({
        id: 'existing_user',
        email: 'existing@example.com'
      })

      await expect(
        service.inviteUser('org_123', 'user_123', {
          email: 'existing@example.com',
          role: 'member',
        })
      ).rejects.toThrow('User already in organization')
    })

    it('should throw error if invite already sent', async () => {
      mockDb.query.organizationUsers.findFirst
        .mockResolvedValueOnce({ role: 'owner' }) // Inviter has permission
        
      mockDb.query.organizationInvites.findFirst.mockResolvedValue({
        id: 'existing_invite',
        email: 'newuser@example.com',
        status: 'pending'
      })

      await expect(
        service.inviteUser('org_123', 'user_123', {
          email: 'newuser@example.com',
          role: 'member',
        })
      ).rejects.toThrow('Invite already sent to this email')
    })
  })

  describe('acceptInvite', () => {
    const mockInvite = {
      id: 'invite_123',
      organizationId: 'org_123',
      email: 'user@example.com',
      role: 'member',
      token: 'invite_token_123',
      status: 'pending',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    }

    const mockUser = {
      id: 'user_123',
      email: 'user@example.com',
    }

    const mockOrganization = {
      id: 'org_123',
      name: 'Test Org',
    }

    beforeEach(() => {
      mockDb.query.organizationInvites.findFirst.mockResolvedValue(mockInvite)
      mockDb.query.users.findFirst.mockResolvedValue(mockUser)
      mockDb.query.organizations.findFirst.mockResolvedValue(mockOrganization)

      mockDb.transaction.mockImplementation(async (callback) => {
        await callback({
          insert: jest.fn().mockReturnValue({
            values: jest.fn().mockResolvedValue({ success: true })
          }),
          update: jest.fn().mockReturnValue({
            set: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue({ success: true })
            })
          })
        })
        return mockInvite.organizationId
      })
    })

    it('should accept invite successfully', async () => {
      const result = await service.acceptInvite('invite_token_123', 'user_123')

      expect(result).toBe('org_123')
      expect(mockEmailService.sendWelcomeToOrganization).toHaveBeenCalledWith({
        to: 'user@example.com',
        organization: mockOrganization,
        role: 'member',
      })
    })

    it('should throw error for invalid invite', async () => {
      mockDb.query.organizationInvites.findFirst.mockResolvedValue(null)

      await expect(
        service.acceptInvite('invalid_token', 'user_123')
      ).rejects.toThrow('Invalid or expired invite')
    })

    it('should throw error for expired invite', async () => {
      mockDb.query.organizationInvites.findFirst.mockResolvedValue({
        ...mockInvite,
        expiresAt: new Date(Date.now() - 1000), // Expired
      })

      await expect(
        service.acceptInvite('invite_token_123', 'user_123')
      ).rejects.toThrow('Invite has expired')
    })

    it('should throw error if invite not for user', async () => {
      mockDb.query.users.findFirst.mockResolvedValue({
        id: 'user_123',
        email: 'different@example.com',
      })

      await expect(
        service.acceptInvite('invite_token_123', 'user_123')
      ).rejects.toThrow('Invite not for this user')
    })
  })

  describe('removeUser', () => {
    beforeEach(() => {
      mockDb.delete.mockReturnValue({
        where: jest.fn().mockResolvedValue({ success: true })
      })
    })

    it('should remove user successfully', async () => {
      mockDb.query.organizationUsers.findFirst
        .mockResolvedValueOnce({ role: 'admin' }) // Remover has admin role
        .mockResolvedValueOnce({ role: 'member', userId: 'user_456' }) // User to remove is a member

      const result = await service.removeUser('org_123', 'user_456', 'user_123')

      expect(result).toBe(true)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Removed user user_456 from organization org_123'
      )
    })

    it('should throw error if remover lacks permission', async () => {
      mockDb.query.organizationUsers.findFirst
        .mockResolvedValueOnce(null) // Remover doesn't have owner/admin role

      await expect(
        service.removeUser('org_123', 'user_456', 'user_123')
      ).rejects.toThrow('Insufficient permissions')
    })

    it('should not allow removing owner', async () => {
      mockDb.query.organizationUsers.findFirst
        .mockResolvedValueOnce({ role: 'owner' }) // Remover is owner
        .mockResolvedValueOnce({ role: 'owner', userId: 'user_456' }) // User to remove is also owner

      await expect(
        service.removeUser('org_123', 'user_456', 'user_123')
      ).rejects.toThrow('Cannot remove organization owner')
    })

    it('should not allow self-removal', async () => {
      mockDb.query.organizationUsers.findFirst
        .mockResolvedValueOnce({ role: 'admin' }) // Remover is admin
        .mockResolvedValueOnce({ role: 'admin', userId: 'user_123' }) // User to remove is same as remover

      await expect(
        service.removeUser('org_123', 'user_123', 'user_123')
      ).rejects.toThrow('Cannot remove yourself')
    })
  })

  describe('updateUserRole', () => {
    beforeEach(() => {
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue({ success: true })
        })
      })
    })

    it('should update role successfully', async () => {
      mockDb.query.organizationUsers.findFirst
        .mockResolvedValueOnce({ role: 'owner' }) // Updater
        .mockResolvedValueOnce({ role: 'member' }) // User to update

      const result = await service.updateUserRole('org_123', 'user_456', 'admin', 'user_123')

      expect(result).toBe(true)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Updated user user_456 role to admin in organization org_123'
      )
    })

    it('should only allow owners to update roles', async () => {
      mockDb.query.organizationUsers.findFirst
        .mockResolvedValueOnce(null) // Updater is not owner

      await expect(
        service.updateUserRole('org_123', 'user_456', 'admin', 'user_123')
      ).rejects.toThrow('Only owners can update roles')
    })

    it('should not allow changing owner role', async () => {
      mockDb.query.organizationUsers.findFirst
        .mockResolvedValueOnce({ role: 'owner' }) // Updater
        .mockResolvedValueOnce({ role: 'owner' }) // User to update

      await expect(
        service.updateUserRole('org_123', 'user_456', 'admin', 'user_123')
      ).rejects.toThrow('Cannot change owner role')
    })
  })

  describe('transferOwnership', () => {
    beforeEach(() => {
      mockDb.transaction.mockImplementation(async (callback) => {
        return callback({
          update: jest.fn().mockReturnValue({
            set: jest.fn().mockReturnValue({
              where: jest.fn().mockResolvedValue({ success: true })
            })
          })
        })
      })
    })

    it('should transfer ownership successfully', async () => {
      mockDb.query.organizationUsers.findFirst
        .mockResolvedValueOnce({ role: 'owner' }) // Current owner
        .mockResolvedValueOnce({ role: 'admin' }) // New owner

      const result = await service.transferOwnership('org_123', 'user_456', 'user_123')

      expect(result).toBe(true)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Transferred ownership of organization org_123 from user_123 to user_456'
      )
    })

    it('should only allow current owner to transfer', async () => {
      mockDb.query.organizationUsers.findFirst
        .mockResolvedValueOnce(null) // Current user is not owner

      await expect(
        service.transferOwnership('org_123', 'user_456', 'user_123')
      ).rejects.toThrow('Only current owner can transfer ownership')
    })

    it('should require new owner to be member', async () => {
      mockDb.query.organizationUsers.findFirst
        .mockResolvedValueOnce({ role: 'owner' })
        .mockResolvedValueOnce(null) // Not a member

      await expect(
        service.transferOwnership('org_123', 'user_456', 'user_123')
      ).rejects.toThrow('New owner must be organization member')
    })
  })
})