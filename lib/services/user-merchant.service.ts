import { db } from '@/lib/db'
import { users, merchants, merchantUsers, userSessions } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { z } from 'zod'

// Type definitions
export type MerchantRole = 'owner' | 'admin' | 'member' | 'viewer'
export type MemberStatus = 'active' | 'suspended' | 'pending_invitation'

export interface UserMerchant {
  merchantId: string
  businessName: string
  slug: string | null
  role: MerchantRole
  joinedAt: Date
  merchantCreatedAt: Date
}

export interface MerchantUser {
  userId: string
  email: string
  firstName: string | null
  lastName: string | null
  role: MerchantRole
  status: MemberStatus
  joinedAt: Date | null
  invitedAt: Date | null
  invitedBy: string | null
}

// Validation schemas
export const createMerchantSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  slug: z.string().optional(),
})

export const inviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
  merchantId: z.string().uuid('Invalid merchant ID'),
})

export const updateUserRoleSchema = z.object({
  merchantId: z.string().uuid('Invalid merchant ID'),
  userId: z.string().uuid('Invalid user ID'),
  role: z.enum(['admin', 'member', 'viewer']),
})

export class UserMerchantService {
  /**
   * Get all merchants for a user with their role
   */
  static async getUserMerchants(userId: string): Promise<UserMerchant[]> {
    const userMerchants = await db
      .select({
        merchantId: merchants.id,
        businessName: merchants.businessName,
        slug: merchants.slug,
        role: merchantUsers.role,
        joinedAt: merchantUsers.joinedAt,
        merchantCreatedAt: merchants.createdAt,
      })
      .from(merchantUsers)
      .innerJoin(merchants, eq(merchantUsers.merchantId, merchants.id))
      .where(
        and(
          eq(merchantUsers.userId, userId),
          eq(merchantUsers.status, 'active')
        )
      )
      .orderBy(desc(merchantUsers.joinedAt))

    return userMerchants.map(item => ({
      ...item,
      joinedAt: new Date(item.joinedAt!),
      merchantCreatedAt: new Date(item.merchantCreatedAt),
    }))
  }

  /**
   * Get all users for a merchant with their roles
   */
  static async getMerchantUsers(merchantId: string): Promise<MerchantUser[]> {
    const merchantUsersList = await db
      .select({
        userId: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: merchantUsers.role,
        status: merchantUsers.status,
        joinedAt: merchantUsers.joinedAt,
        invitedAt: merchantUsers.invitedAt,
        invitedBy: merchantUsers.invitedBy,
      })
      .from(merchantUsers)
      .innerJoin(users, eq(merchantUsers.userId, users.id))
      .where(eq(merchantUsers.merchantId, merchantId))
      .orderBy(desc(merchantUsers.createdAt))

    return merchantUsersList.map(item => ({
      ...item,
      joinedAt: item.joinedAt ? new Date(item.joinedAt) : null,
      invitedAt: item.invitedAt ? new Date(item.invitedAt) : null,
    }))
  }

  /**
   * Check if user has access to merchant with minimum role
   */
  static async checkUserMerchantAccess(
    userId: string,
    merchantId: string,
    requiredRole: MerchantRole = 'member'
  ): Promise<{ hasAccess: boolean; userRole?: MerchantRole }> {
    const relationship = await db
      .select({ role: merchantUsers.role })
      .from(merchantUsers)
      .where(
        and(
          eq(merchantUsers.userId, userId),
          eq(merchantUsers.merchantId, merchantId),
          eq(merchantUsers.status, 'active')
        )
      )
      .limit(1)

    if (relationship.length === 0) {
      return { hasAccess: false }
    }

    const userRole = relationship[0].role as MerchantRole
    const hasAccess = this.hasRolePermission(userRole, requiredRole)

    return { hasAccess, userRole }
  }

  /**
   * Create a new merchant with the user as owner
   */
  static async createMerchant(
    userId: string,
    data: z.infer<typeof createMerchantSchema>
  ) {
    const validatedData = createMerchantSchema.parse(data)
    
    // Generate slug if not provided
    let slug = validatedData.slug
    if (!slug) {
      slug = validatedData.businessName
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
    }

    // Ensure slug is unique
    let finalSlug = slug
    let counter = 0
    while (true) {
      const existing = await db
        .select({ id: merchants.id })
        .from(merchants)
        .where(eq(merchants.slug, finalSlug))
        .limit(1)

      if (existing.length === 0) break
      
      counter++
      finalSlug = `${slug}-${counter}`
    }

    // Create merchant
    const [merchant] = await db
      .insert(merchants)
      .values({
        businessName: validatedData.businessName,
        createdBy: userId,
        slug: finalSlug,
      })
      .returning()

    // Add user as owner
    await db.insert(merchantUsers).values({
      merchantId: merchant.id,
      userId,
      role: 'owner',
      status: 'active',
    })

    return merchant
  }

  /**
   * Add user to merchant with role
   */
  static async addUserToMerchant(
    merchantId: string,
    userId: string,
    role: MerchantRole,
    invitedBy?: string
  ) {
    const [relationship] = await db
      .insert(merchantUsers)
      .values({
        merchantId,
        userId,
        role,
        invitedBy,
        status: 'active',
      })
      .onConflictDoUpdate({
        target: [merchantUsers.merchantId, merchantUsers.userId],
        set: {
          role,
          status: 'active',
          joinedAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning()

    return relationship
  }

  /**
   * Update user's role in merchant
   */
  static async updateUserRole(
    merchantId: string,
    userId: string,
    newRole: MerchantRole,
    updatedBy: string
  ) {
    // Don't allow changing owner role (would need separate transfer ownership)
    const current = await db
      .select({ role: merchantUsers.role })
      .from(merchantUsers)
      .where(
        and(
          eq(merchantUsers.merchantId, merchantId),
          eq(merchantUsers.userId, userId)
        )
      )
      .limit(1)

    if (current.length === 0) {
      throw new Error('User is not a member of this merchant')
    }

    if (current[0].role === 'owner') {
      throw new Error('Cannot change owner role. Use transfer ownership instead.')
    }

    const [updated] = await db
      .update(merchantUsers)
      .set({
        role: newRole,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(merchantUsers.merchantId, merchantId),
          eq(merchantUsers.userId, userId)
        )
      )
      .returning()

    return updated
  }

  /**
   * Remove user from merchant
   */
  static async removeUserFromMerchant(
    merchantId: string,
    userId: string,
    removedBy: string
  ) {
    // Don't allow removing owners
    const current = await db
      .select({ role: merchantUsers.role })
      .from(merchantUsers)
      .where(
        and(
          eq(merchantUsers.merchantId, merchantId),
          eq(merchantUsers.userId, userId)
        )
      )
      .limit(1)

    if (current.length === 0) {
      throw new Error('User is not a member of this merchant')
    }

    if (current[0].role === 'owner') {
      throw new Error('Cannot remove owner. Transfer ownership first.')
    }

    await db
      .delete(merchantUsers)
      .where(
        and(
          eq(merchantUsers.merchantId, merchantId),
          eq(merchantUsers.userId, userId)
        )
      )

    return true
  }

  /**
   * Get or create user session with merchant context
   */
  static async getUserSession(userId: string, merchantId?: string) {
    // Try to get existing session
    let session = await db
      .select()
      .from(userSessions)
      .where(eq(userSessions.userId, userId))
      .limit(1)

    if (session.length === 0) {
      // Create new session
      const [newSession] = await db
        .insert(userSessions)
        .values({
          userId,
          currentMerchantId: merchantId,
        })
        .returning()

      return newSession
    }

    // Update current merchant if provided
    if (merchantId && session[0].currentMerchantId !== merchantId) {
      const [updatedSession] = await db
        .update(userSessions)
        .set({
          currentMerchantId: merchantId,
          updatedAt: new Date(),
        })
        .where(eq(userSessions.id, session[0].id))
        .returning()

      return updatedSession
    }

    return session[0]
  }

  /**
   * Switch user's current merchant context
   */
  static async switchMerchantContext(userId: string, merchantId: string) {
    // Verify user has access to this merchant
    const access = await this.checkUserMerchantAccess(userId, merchantId)
    if (!access.hasAccess) {
      throw new Error('User does not have access to this merchant')
    }

    return await this.getUserSession(userId, merchantId)
  }

  /**
   * Helper: Check if a role has permission for required role
   */
  private static hasRolePermission(userRole: MerchantRole, requiredRole: MerchantRole): boolean {
    const roleHierarchy: Record<MerchantRole, number> = {
      viewer: 1,
      member: 2, 
      admin: 3,
      owner: 4,
    }

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
  }

  /**
   * Get role permissions for a user role
   */
  static getRolePermissions(role: MerchantRole) {
    switch (role) {
      case 'owner':
        return {
          tabs: { create: true, edit: true, delete: true, view: true },
          invoices: { create: true, send: true, void: true, view: true },
          payments: { process: true, refund: true, view: true },
          settings: { processors: true, team: true, api_keys: true, merchant: true },
          reports: { financial: true, analytics: true },
        }
      case 'admin':
        return {
          tabs: { create: true, edit: true, delete: true, view: true },
          invoices: { create: true, send: true, void: true, view: true },
          payments: { process: true, refund: true, view: true },
          settings: { processors: true, team: true, api_keys: true, merchant: false },
          reports: { financial: true, analytics: true },
        }
      case 'member':
        return {
          tabs: { create: true, edit: true, delete: false, view: true },
          invoices: { create: true, send: true, void: false, view: true },
          payments: { process: true, refund: false, view: true },
          settings: { processors: false, team: false, api_keys: false, merchant: false },
          reports: { financial: false, analytics: true },
        }
      case 'viewer':
        return {
          tabs: { create: false, edit: false, delete: false, view: true },
          invoices: { create: false, send: false, void: false, view: true },
          payments: { process: false, refund: false, view: true },
          settings: { processors: false, team: false, api_keys: false, merchant: false },
          reports: { financial: false, analytics: false },
        }
    }
  }
}