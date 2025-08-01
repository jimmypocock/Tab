/**
 * Organization Repository
 */

import { eq, and, or, like } from 'drizzle-orm'
import { organizations, organizationUsers, invitations } from '@/lib/db/schema'
import { BaseRepository } from './base.repository'

export interface OrganizationWithMembers {
  id: string
  name: string
  isMerchant: boolean
  isCorporate: boolean
  metadata?: any
  members?: any[]
  invitations?: any[]
}

export class OrganizationRepository extends BaseRepository {
  readonly name = 'OrganizationRepository'

  async findById(id: string): Promise<OrganizationWithMembers | null> {
    return this.db.query.organizations.findFirst({
      where: eq(organizations.id, id),
      with: {
        members: {
          with: {
            user: true
          }
        },
        invitations: {
          where: (invitations: any, { eq }: any) => eq(invitations.status, 'pending')
        }
      }
    })
  }

  async findByUserId(userId: string): Promise<OrganizationWithMembers[]> {
    const memberOrgs = await this.db.query.organizationUsers.findMany({
      where: eq(organizationUsers.userId, userId),
      with: {
        organization: true
      }
    })

    return memberOrgs.map((m: any) => m.organization)
  }

  async create(data: {
    name: string
    isMerchant?: boolean
    isCorporate?: boolean
    metadata?: any
  }) {
    const [org] = await this.db.insert(organizations)
      .values(data)
      .returning()
    
    return org
  }

  async update(id: string, updates: Partial<OrganizationWithMembers>) {
    const [updated] = await this.db
      .update(organizations)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, id))
      .returning()
    
    return updated
  }

  async addMember(organizationId: string, userId: string, role: string = 'member') {
    const [member] = await this.db.insert(organizationUsers)
      .values({
        organizationId,
        userId,
        role,
      })
      .returning()
    
    return member
  }

  async removeMember(organizationId: string, userId: string) {
    return this.db.delete(organizationUsers)
      .where(and(
        eq(organizationUsers.organizationId, organizationId),
        eq(organizationUsers.userId, userId)
      ))
  }

  async updateMemberRole(organizationId: string, userId: string, role: string) {
    const [updated] = await this.db
      .update(organizationUsers)
      .set({ role, updatedAt: new Date() })
      .where(and(
        eq(organizationUsers.organizationId, organizationId),
        eq(organizationUsers.userId, userId)
      ))
      .returning()
    
    return updated
  }

  async updateMember(organizationId: string, userId: string, updates: {
    status?: 'active' | 'inactive'
    department?: string | null
    title?: string | null
  }) {
    const [updated] = await this.db
      .update(organizationUsers)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(organizationUsers.organizationId, organizationId),
        eq(organizationUsers.userId, userId)
      ))
      .returning()
    
    return updated
  }

  async getMemberRole(organizationId: string, userId: string): Promise<string | null> {
    const member = await this.db.query.organizationUsers.findFirst({
      where: and(
        eq(organizationUsers.organizationId, organizationId),
        eq(organizationUsers.userId, userId)
      )
    })
    
    return member?.role || null
  }

  async createInvitation(data: {
    organizationId: string
    email: string
    role: string
    invitedBy: string
    expiresAt: Date
  }) {
    const [invitation] = await this.db.insert(invitations)
      .values({
        ...data,
        status: 'pending',
        token: this.generateInvitationToken(),
      })
      .returning()
    
    return invitation
  }

  async findInvitationByToken(token: string) {
    return this.db.query.invitations.findFirst({
      where: eq(invitations.token, token),
      with: {
        organization: true
      }
    })
  }

  async acceptInvitation(invitationId: string) {
    const [updated] = await this.db
      .update(invitations)
      .set({
        status: 'accepted',
        acceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(invitations.id, invitationId))
      .returning()
    
    return updated
  }

  async getPendingInvitations(organizationId: string) {
    const pendingInvites = await this.db.query.invitations.findMany({
      where: and(
        eq(invitations.organizationId, organizationId),
        eq(invitations.status, 'pending')
      ),
      with: {
        invitedBy: {
          columns: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: (invitations, { desc }) => [desc(invitations.createdAt)]
    })

    // Filter out expired invitations
    const now = new Date()
    return pendingInvites
      .filter(inv => new Date(inv.expiresAt) > now)
      .map(inv => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        message: inv.message,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
        invitedBy: {
          id: inv.invitedBy?.id || inv.invitedById,
          email: inv.invitedBy?.email || 'Unknown',
          name: inv.invitedBy?.firstName && inv.invitedBy?.lastName 
            ? `${inv.invitedBy.firstName} ${inv.invitedBy.lastName}`
            : inv.invitedBy?.email || 'Unknown'
        }
      }))
  }

  async search(query: string): Promise<OrganizationWithMembers[]> {
    return this.db.query.organizations.findMany({
      where: or(
        like(organizations.name, `%${query}%`),
        like(organizations.billingEmail, `%${query}%`)
      ),
      limit: 10
    })
  }

  private generateInvitationToken(): string {
    return `inv_${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`
  }
}