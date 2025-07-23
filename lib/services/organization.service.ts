import { eq, and, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { 
  organizations, 
  organizationUsers, 
  organizationRelationships,
  apiKeys,
  type Organization,
  type NewOrganization,
  type OrganizationUser,
  type NewOrganizationUser,
  type OrganizationRelationship,
  type NewOrganizationRelationship
} from '@/lib/db/schema'
import { generateApiKey, hashApiKey } from '@/lib/utils/api-keys'
import { NotFoundError, ValidationError } from '@/lib/errors'

export type OrganizationRole = 'owner' | 'admin' | 'member' | 'viewer'
export type OrganizationContext = 'merchant' | 'corporate'

export interface OrganizationWithUsers extends Organization {
  users?: OrganizationUser[]
}

export interface OrganizationWithRelationships extends Organization {
  merchantRelationships?: OrganizationRelationship[]
  corporateRelationships?: OrganizationRelationship[]
}

export class OrganizationService {
  /**
   * Create a new organization
   */
  static async createOrganization(data: NewOrganization & { createdBy: string }): Promise<Organization> {
    const [organization] = await db
      .insert(organizations)
      .values(data)
      .returning()

    // Add creator as owner
    await this.addUserToOrganization({
      organizationId: organization.id,
      userId: data.createdBy,
      role: 'owner',
      status: 'active',
      joinedAt: new Date()
    })

    return organization
  }

  /**
   * Get organization by ID
   */
  static async getOrganizationById(id: string): Promise<Organization | null> {
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1)

    return organization || null
  }

  /**
   * Get organizations for a user
   */
  static async getUserOrganizations(
    userId: string,
    context?: OrganizationContext
  ): Promise<OrganizationWithUsers[]> {
    const query = db
      .select({
        organization: organizations,
        userRole: organizationUsers.role,
        userStatus: organizationUsers.status
      })
      .from(organizationUsers)
      .innerJoin(organizations, eq(organizationUsers.organizationId, organizations.id))
      .where(
        and(
          eq(organizationUsers.userId, userId),
          eq(organizationUsers.status, 'active')
        )
      )

    // Filter by context if specified
    if (context === 'merchant') {
      query.where(and(
        eq(organizationUsers.userId, userId),
        eq(organizationUsers.status, 'active'),
        eq(organizations.isMerchant, true)
      ))
    } else if (context === 'corporate') {
      query.where(and(
        eq(organizationUsers.userId, userId),
        eq(organizationUsers.status, 'active'),
        eq(organizations.isCorporate, true)
      ))
    }

    const results = await query

    return results.map(r => ({
      ...r.organization,
      users: [{
        ...r.userRole,
        status: r.userStatus
      } as OrganizationUser]
    }))
  }

  /**
   * Add user to organization
   */
  static async addUserToOrganization(data: NewOrganizationUser): Promise<OrganizationUser> {
    const [user] = await db
      .insert(organizationUsers)
      .values(data)
      .returning()

    return user
  }

  /**
   * Update user role in organization
   */
  static async updateUserRole(
    organizationId: string,
    userId: string,
    role: OrganizationRole
  ): Promise<OrganizationUser> {
    const [updated] = await db
      .update(organizationUsers)
      .set({ role, updatedAt: new Date() })
      .where(
        and(
          eq(organizationUsers.organizationId, organizationId),
          eq(organizationUsers.userId, userId)
        )
      )
      .returning()

    if (!updated) {
      throw new NotFoundError('User not found in organization')
    }

    return updated
  }

  /**
   * Remove user from organization
   */
  static async removeUserFromOrganization(
    organizationId: string,
    userId: string
  ): Promise<void> {
    // Check if user is the last owner
    const owners = await db
      .select()
      .from(organizationUsers)
      .where(
        and(
          eq(organizationUsers.organizationId, organizationId),
          eq(organizationUsers.role, 'owner'),
          eq(organizationUsers.status, 'active')
        )
      )

    if (owners.length === 1 && owners[0].userId === userId) {
      throw new ValidationError('Cannot remove the last owner')
    }

    await db
      .delete(organizationUsers)
      .where(
        and(
          eq(organizationUsers.organizationId, organizationId),
          eq(organizationUsers.userId, userId)
        )
      )
  }

  /**
   * Check if user has access to organization with required role
   */
  static async checkUserAccess(
    userId: string,
    organizationId: string,
    requiredRole: OrganizationRole = 'member',
    context?: OrganizationContext
  ): Promise<{ hasAccess: boolean; userRole?: OrganizationRole }> {
    const [orgUser] = await db
      .select()
      .from(organizationUsers)
      .innerJoin(organizations, eq(organizationUsers.organizationId, organizations.id))
      .where(
        and(
          eq(organizationUsers.userId, userId),
          eq(organizationUsers.organizationId, organizationId),
          eq(organizationUsers.status, 'active')
        )
      )
      .limit(1)

    if (!orgUser) {
      return { hasAccess: false }
    }

    // Check context matches organization capabilities
    const org = orgUser.organizations
    if (context === 'merchant' && !org.isMerchant) {
      return { hasAccess: false }
    }
    if (context === 'corporate' && !org.isCorporate) {
      return { hasAccess: false }
    }

    const userRole = orgUser.organization_users.role as OrganizationRole
    const hasAccess = this.checkRoleHierarchy(userRole, requiredRole)

    return { hasAccess, userRole }
  }

  /**
   * Check role hierarchy
   */
  static checkRoleHierarchy(userRole: OrganizationRole, requiredRole: OrganizationRole): boolean {
    const roleHierarchy: Record<OrganizationRole, number> = {
      owner: 4,
      admin: 3,
      member: 2,
      viewer: 1
    }

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
  }

  /**
   * Create relationship between organizations
   */
  static async createRelationship(
    data: NewOrganizationRelationship & { approvedBy: string }
  ): Promise<OrganizationRelationship> {
    // Verify merchant capability
    const merchantOrg = await this.getOrganizationById(data.merchantOrgId)
    if (!merchantOrg?.isMerchant) {
      throw new ValidationError('Organization does not have merchant capability')
    }

    // Verify corporate capability
    const corporateOrg = await this.getOrganizationById(data.corporateOrgId)
    if (!corporateOrg?.isCorporate) {
      throw new ValidationError('Organization does not have corporate capability')
    }

    const [relationship] = await db
      .insert(organizationRelationships)
      .values({
        ...data,
        approvedAt: new Date()
      })
      .returning()

    return relationship
  }

  /**
   * Get relationships for an organization
   */
  static async getOrganizationRelationships(
    organizationId: string,
    type: 'merchant' | 'corporate'
  ): Promise<OrganizationRelationship[]> {
    if (type === 'merchant') {
      return db
        .select()
        .from(organizationRelationships)
        .where(eq(organizationRelationships.merchantOrgId, organizationId))
    } else {
      return db
        .select()
        .from(organizationRelationships)
        .where(eq(organizationRelationships.corporateOrgId, organizationId))
    }
  }

  /**
   * Update organization settings
   */
  static async updateOrganization(
    id: string,
    data: Partial<Organization>
  ): Promise<Organization> {
    const [updated] = await db
      .update(organizations)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(organizations.id, id))
      .returning()

    if (!updated) {
      throw new NotFoundError('Organization')
    }

    return updated
  }

  /**
   * Generate API key for organization
   */
  static async generateApiKey(
    organizationId: string,
    name: string,
    scope: 'merchant' | 'corporate' | 'full',
    createdBy: string
  ): Promise<{ key: string; keyId: string }> {
    const organization = await this.getOrganizationById(organizationId)
    if (!organization) {
      throw new NotFoundError('Organization')
    }

    // Verify scope matches organization capabilities
    if (scope === 'merchant' && !organization.isMerchant) {
      throw new ValidationError('Organization does not have merchant capability')
    }
    if (scope === 'corporate' && !organization.isCorporate) {
      throw new ValidationError('Organization does not have corporate capability')
    }

    const apiKey = generateApiKey('org', scope === 'merchant' ? 'live' : 'corp')
    const keyHash = await hashApiKey(apiKey)
    const keyPrefix = apiKey.substring(0, 8)

    const [record] = await db
      .insert(apiKeys)
      .values({
        organizationId,
        keyHash,
        keyPrefix,
        name,
        scope,
        createdBy
      })
      .returning()

    return { key: apiKey, keyId: record.id }
  }

  /**
   * Migrate merchant to organization (for backward compatibility)
   */
  static async getMerchantAsOrganization(merchantId: string): Promise<Organization | null> {
    // During migration, check if organization exists with same ID as merchant
    return this.getOrganizationById(merchantId)
  }

  /**
   * Get organization statistics
   */
  static async getOrganizationStats(organizationId: string) {
    const org = await this.getOrganizationById(organizationId)
    if (!org) {
      throw new NotFoundError('Organization')
    }

    const stats: any = {
      organization: org
    }

    // Get merchant stats if applicable
    if (org.isMerchant) {
      const [merchantStats] = await db.execute(sql`
        SELECT 
          COUNT(DISTINCT t.id) as total_tabs,
          COUNT(DISTINCT CASE WHEN t.status = 'open' THEN t.id END) as open_tabs,
          COUNT(DISTINCT CASE WHEN t.status = 'paid' THEN t.id END) as paid_tabs,
          COALESCE(SUM(t.total_amount), 0) as total_revenue,
          COALESCE(SUM(CASE WHEN t.status = 'open' THEN t.total_amount - t.paid_amount END), 0) as outstanding_amount
        FROM tabs t
        WHERE t.organization_id = ${organizationId}
      `)
      stats.merchantStats = merchantStats
    }

    // Get corporate stats if applicable
    if (org.isCorporate) {
      const [corporateStats] = await db.execute(sql`
        SELECT 
          COUNT(DISTINCT t.id) as total_purchases,
          COALESCE(SUM(t.total_amount), 0) as total_spent,
          COUNT(DISTINCT r.id) as active_relationships
        FROM tabs t
        LEFT JOIN organization_relationships r ON r.corporate_org_id = ${organizationId} AND r.status = 'active'
        WHERE t.paid_by_org_id = ${organizationId}
      `)
      stats.corporateStats = corporateStats
    }

    return stats
  }
}