/**
 * Organization Management Service
 */

import { DITokens } from '@/lib/di/types'
import type { IDIContainer } from '@/lib/di/types'
import { OrganizationRepository } from '@/lib/repositories/organization.repository'
import { ApiKeyRepository } from '@/lib/repositories/api-key.repository'
import { EmailService } from './email.service'
import { ValidationError, BusinessRuleError } from '@/lib/errors'
import { logger } from '@/lib/logger'

export interface CreateOrganizationInput {
  name: string
  isMerchant?: boolean
  isCorporate?: boolean
  billingEmail?: string
  metadata?: any
}

export interface InviteMemberInput {
  email: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  message?: string
}

export class OrganizationManagementService {
  private orgRepo: OrganizationRepository
  private apiKeyRepo: ApiKeyRepository
  private emailService: EmailService
  private logger: typeof logger

  constructor(container: IDIContainer) {
    this.orgRepo = container.resolve(DITokens.OrganizationRepository)
    this.apiKeyRepo = container.resolve(DITokens.ApiKeyRepository)
    this.emailService = container.resolve(DITokens.EmailService)
    this.logger = container.resolve(DITokens.Logger)
  }

  /**
   * Create a new organization
   */
  async createOrganization(
    userId: string,
    input: CreateOrganizationInput
  ) {
    // Validate input
    if (!input.name || input.name.trim().length === 0) {
      throw new ValidationError('Organization name is required')
    }

    // Create organization
    const org = await this.orgRepo.create({
      name: input.name.trim(),
      isMerchant: input.isMerchant ?? true,
      isCorporate: input.isCorporate ?? false,
      billingEmail: input.billingEmail,
      metadata: input.metadata,
    })

    // Add creator as owner
    await this.orgRepo.addMember(org.id, userId, 'owner')

    // Create default API keys if merchant
    if (org.isMerchant) {
      await this.createDefaultApiKeys(org.id)
    }

    this.logger.info('Organization created', {
      organizationId: org.id,
      userId,
      isMerchant: org.isMerchant,
    })

    return org
  }

  /**
   * Update organization details
   */
  async updateOrganization(
    organizationId: string,
    userId: string,
    updates: Partial<CreateOrganizationInput>
  ) {
    // Check permissions
    const role = await this.orgRepo.getMemberRole(organizationId, userId)
    if (!role || !['owner', 'admin'].includes(role)) {
      throw new BusinessRuleError('Insufficient permissions')
    }

    const updated = await this.orgRepo.update(organizationId, updates)
    
    this.logger.info('Organization updated', {
      organizationId,
      userId,
      updates: Object.keys(updates),
    })

    return updated
  }

  /**
   * Get organization details
   */
  async getOrganization(organizationId: string, userId: string) {
    const org = await this.orgRepo.findById(organizationId)
    
    if (!org) {
      throw new ValidationError('Organization not found')
    }

    // Check if user is a member
    const isMember = org.members?.some((m: any) => m.userId === userId)
    if (!isMember) {
      throw new BusinessRuleError('Access denied')
    }

    return org
  }

  /**
   * List user's organizations
   */
  async listUserOrganizations(userId: string) {
    return this.orgRepo.findByUserId(userId)
  }

  /**
   * Invite a member to organization
   */
  async inviteMember(
    organizationId: string,
    inviterId: string,
    input: InviteMemberInput
  ) {
    // Check permissions
    const inviterRole = await this.orgRepo.getMemberRole(organizationId, inviterId)
    if (!inviterRole || !['owner', 'admin'].includes(inviterRole)) {
      throw new BusinessRuleError('Insufficient permissions to invite members')
    }

    // Check if already a member
    const existingMembers = await this.orgRepo.findById(organizationId)
    const isAlreadyMember = existingMembers?.members?.some(
      (m: any) => m.user?.email === input.email
    )
    
    if (isAlreadyMember) {
      throw new BusinessRuleError('User is already a member')
    }

    // Create invitation
    const invitation = await this.orgRepo.createInvitation({
      organizationId,
      email: input.email,
      role: input.role,
      invitedBy: inviterId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    })

    // Send invitation email
    await this.emailService.send({
      to: input.email,
      subject: `You're invited to join ${existingMembers?.name}`,
      html: `
        <h2>Organization Invitation</h2>
        <p>You've been invited to join ${existingMembers?.name} as a ${input.role}.</p>
        ${input.message ? `<p>Message: ${input.message}</p>` : ''}
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/auth/accept-invitation?token=${invitation.token}">Accept Invitation</a></p>
        <p>This invitation expires in 7 days.</p>
      `
    })

    this.logger.info('Member invited', {
      organizationId,
      inviterId,
      inviteeEmail: input.email,
      role: input.role,
    })

    return invitation
  }

  /**
   * Accept an invitation
   */
  async acceptInvitation(token: string, userId: string) {
    const invitation = await this.orgRepo.findInvitationByToken(token)
    
    if (!invitation) {
      throw new ValidationError('Invalid invitation')
    }

    if (invitation.status !== 'pending') {
      throw new BusinessRuleError('Invitation has already been used')
    }

    if (new Date() > invitation.expiresAt) {
      throw new BusinessRuleError('Invitation has expired')
    }

    // Add member
    await this.orgRepo.addMember(
      invitation.organizationId,
      userId,
      invitation.role
    )

    // Update invitation
    await this.orgRepo.acceptInvitation(invitation.id)

    this.logger.info('Invitation accepted', {
      invitationId: invitation.id,
      organizationId: invitation.organizationId,
      userId,
    })

    return invitation.organization
  }

  /**
   * Remove a member
   */
  async removeMember(
    organizationId: string,
    requesterId: string,
    memberUserId: string
  ) {
    // Check permissions
    const requesterRole = await this.orgRepo.getMemberRole(organizationId, requesterId)
    if (requesterRole !== 'owner') {
      throw new BusinessRuleError('Only owners can remove members')
    }

    // Can't remove yourself if you're the only owner
    if (requesterId === memberUserId) {
      const org = await this.orgRepo.findById(organizationId)
      const ownerCount = org?.members?.filter((m: any) => m.role === 'owner').length || 0
      
      if (ownerCount <= 1) {
        throw new BusinessRuleError('Cannot remove the last owner')
      }
    }

    await this.orgRepo.removeMember(organizationId, memberUserId)

    this.logger.info('Member removed', {
      organizationId,
      requesterId,
      removedUserId: memberUserId,
    })
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    organizationId: string,
    requesterId: string,
    memberUserId: string,
    newRole: string
  ) {
    // Check permissions
    const requesterRole = await this.orgRepo.getMemberRole(organizationId, requesterId)
    if (requesterRole !== 'owner') {
      throw new BusinessRuleError('Only owners can change roles')
    }

    // Can't change your own role if you're the only owner
    if (requesterId === memberUserId && requesterRole === 'owner' && newRole !== 'owner') {
      const org = await this.orgRepo.findById(organizationId)
      const ownerCount = org?.members?.filter((m: any) => m.role === 'owner').length || 0
      
      if (ownerCount <= 1) {
        throw new BusinessRuleError('Cannot remove the last owner')
      }
    }

    await this.orgRepo.updateMemberRole(organizationId, memberUserId, newRole)

    this.logger.info('Member role updated', {
      organizationId,
      requesterId,
      memberUserId,
      newRole,
    })
  }

  /**
   * Get team members
   */
  async getTeamMembers(organizationId: string) {
    const org = await this.orgRepo.findById(organizationId)
    
    if (!org) {
      throw new ValidationError('Organization not found')
    }

    return org.members || []
  }

  /**
   * Update team member details
   */
  async updateTeamMember(
    organizationId: string,
    memberUserId: string,
    updates: {
      role?: 'admin' | 'member' | 'viewer'
      status?: 'active' | 'inactive'
      department?: string | null
      title?: string | null
    },
    requesterId: string
  ) {
    // Check permissions
    const requesterRole = await this.orgRepo.getMemberRole(organizationId, requesterId)
    if (!requesterRole || !['owner', 'admin'].includes(requesterRole)) {
      throw new BusinessRuleError('Insufficient permissions to update team members')
    }

    // Get current member to check role
    const org = await this.orgRepo.findById(organizationId)
    const currentMember = org?.members?.find((m: any) => m.userId === memberUserId)
    
    if (!currentMember) {
      throw new ValidationError('Team member not found')
    }

    // Prevent demoting the last owner
    if (updates.role && updates.role !== 'owner' && currentMember.role === 'owner') {
      const ownerCount = org?.members?.filter((m: any) => m.role === 'owner' && m.status === 'active').length || 0
      
      if (ownerCount <= 1) {
        throw new BusinessRuleError('Cannot demote the last owner of the organization')
      }
    }

    // Update member - handle role separately if changing
    if (updates.role && updates.role !== currentMember.role) {
      await this.orgRepo.updateMemberRole(organizationId, memberUserId, updates.role)
    }

    // Update other member details
    const updatedMember = await this.orgRepo.updateMember(organizationId, memberUserId, {
      status: updates.status,
      department: updates.department,
      title: updates.title,
    })

    this.logger.info('Team member updated', {
      organizationId,
      requesterId,
      memberUserId,
      updates: Object.keys(updates),
    })

    return updatedMember
  }

  /**
   * Remove team member
   */
  async removeTeamMember(
    organizationId: string,
    memberUserId: string,
    requesterId: string
  ) {
    // Check permissions
    const requesterRole = await this.orgRepo.getMemberRole(organizationId, requesterId)
    if (!requesterRole || !['owner', 'admin'].includes(requesterRole)) {
      throw new BusinessRuleError('Insufficient permissions to remove team members')
    }

    // Prevent removing yourself
    if (memberUserId === requesterId) {
      throw new BusinessRuleError('You cannot remove yourself from the organization')
    }

    // Get member to check role
    const org = await this.orgRepo.findById(organizationId)
    const member = org?.members?.find((m: any) => m.userId === memberUserId)
    
    if (!member) {
      throw new ValidationError('Team member not found')
    }

    // Prevent removing the last owner
    if (member.role === 'owner') {
      const ownerCount = org?.members?.filter((m: any) => m.role === 'owner' && m.status === 'active').length || 0
      
      if (ownerCount <= 1) {
        throw new BusinessRuleError('Cannot remove the last owner of the organization')
      }
    }

    await this.orgRepo.removeMember(organizationId, memberUserId)

    this.logger.info('Team member removed', {
      organizationId,
      requesterId,
      removedUserId: memberUserId,
    })
  }

  /**
   * Create default API keys for a new merchant organization
   */
  private async createDefaultApiKeys(organizationId: string) {
    // Create test key
    const { plainTextKey: testKey } = await this.apiKeyRepo.create({
      organizationId,
      name: 'Default Test Key',
      environment: 'test',
      scope: 'full',
    })

    // Create live key
    const { plainTextKey: liveKey } = await this.apiKeyRepo.create({
      organizationId,
      name: 'Default Live Key',
      environment: 'live',
      scope: 'full',
    })

    this.logger.info('Default API keys created', {
      organizationId,
      hasTestKey: !!testKey,
      hasLiveKey: !!liveKey,
    })
  }
}