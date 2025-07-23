import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { 
  merchants, 
  organizations,
  tabs,
  merchantProcessors,
  invoices,
  type Merchant
} from '@/lib/db/schema'
import { OrganizationService } from './organization.service'
import { logger } from '@/lib/logger'

/**
 * Helper service to provide backward compatibility during migration
 * Maps old merchant/corporate concepts to new organization model
 */
export class MigrationHelperService {
  /**
   * Get merchant data using organization ID
   * Provides backward compatibility for code expecting merchant objects
   */
  static async getMerchantById(merchantId: string): Promise<Merchant | null> {
    // First try to get from merchants table (legacy)
    const [merchant] = await db
      .select()
      .from(merchants)
      .where(eq(merchants.id, merchantId))
      .limit(1)

    if (merchant) {
      return merchant
    }

    // Fall back to organizations table
    const org = await OrganizationService.getOrganizationById(merchantId)
    if (!org || !org.isMerchant) {
      return null
    }

    // Map organization to merchant-like object
    return {
      id: org.id,
      email: org.primaryEmail,
      businessName: org.name,
      createdBy: org.createdBy,
      slug: org.slug,
      settings: org.settings,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt
    } as Merchant
  }

  /**
   * Update references from merchant_id to organization_id
   * Run this after creating organizations from merchants
   */
  static async updateMerchantReferences(merchantId: string, organizationId: string) {
    try {
      // Update tabs
      await db
        .update(tabs)
        .set({ organizationId })
        .where(eq(tabs.merchantId, merchantId))

      // Update merchant_processors
      await db
        .update(merchantProcessors)
        .set({ organizationId })
        .where(eq(merchantProcessors.merchantId, merchantId))

      // Update invoices
      await db
        .update(invoices)
        .set({ organizationId })
        .where(eq(invoices.merchantId, merchantId))

      logger.info('Updated merchant references', { merchantId, organizationId })
    } catch (error) {
      logger.error('Failed to update merchant references', { merchantId, organizationId, error })
      throw error
    }
  }

  /**
   * Check if a merchant has been migrated to organization
   */
  static async isMerchantMigrated(merchantId: string): Promise<boolean> {
    const org = await OrganizationService.getOrganizationById(merchantId)
    return org !== null && org.isMerchant
  }

  /**
   * Get organization ID from various legacy ID types
   */
  static async resolveOrganizationId(params: {
    merchantId?: string
    corporateAccountId?: string
    organizationId?: string
  }): Promise<string | null> {
    // Prefer organization ID if provided
    if (params.organizationId) {
      return params.organizationId
    }

    // Check if merchant ID is actually an organization
    if (params.merchantId) {
      const migrated = await this.isMerchantMigrated(params.merchantId)
      if (migrated) {
        return params.merchantId
      }
    }

    // Check if corporate account ID is actually an organization
    if (params.corporateAccountId) {
      const org = await OrganizationService.getOrganizationById(params.corporateAccountId)
      if (org && org.isCorporate) {
        return params.corporateAccountId
      }
    }

    return null
  }

  /**
   * Middleware adapter to support both old and new auth patterns
   */
  static async adaptAuthContext(context: any): Promise<any> {
    // If it's already organization context, return as-is
    if (context.organizationId && context.organization) {
      return context
    }

    // Convert merchant context to organization context
    if (context.merchantId && context.merchant) {
      const org = await OrganizationService.getOrganizationById(context.merchantId)
      if (org) {
        return {
          organizationId: org.id,
          organization: {
            id: org.id,
            name: org.name,
            isMerchant: org.isMerchant,
            isCorporate: org.isCorporate
          },
          scope: 'merchant',
          authType: context.authType || 'apiKey',
          userId: context.userId,
          userRole: context.userRole
        }
      }
    }

    // Convert corporate context to organization context
    if (context.corporateAccountId && context.corporateAccount) {
      const org = await OrganizationService.getOrganizationById(context.corporateAccountId)
      if (org) {
        return {
          organizationId: org.id,
          organization: {
            id: org.id,
            name: org.name,
            isMerchant: org.isMerchant,
            isCorporate: org.isCorporate
          },
          scope: 'corporate',
          authType: context.authType || 'apiKey',
          userId: context.userId,
          userRole: context.userRole
        }
      }
    }

    return context
  }

  /**
   * Create wrapper for API handlers to support both patterns
   */
  static wrapHandler(
    handler: (req: any, context: any) => Promise<any>,
    useOrganization: boolean = true
  ) {
    return async (req: any, context: any) => {
      if (useOrganization) {
        // Convert to organization context if needed
        const orgContext = await this.adaptAuthContext(context)
        
        // Add backward compatibility properties
        if (orgContext.organization?.isMerchant) {
          orgContext.merchantId = orgContext.organizationId
          orgContext.merchant = await this.getMerchantById(orgContext.organizationId)
        }
        
        return handler(req, orgContext)
      }
      
      return handler(req, context)
    }
  }

  /**
   * Helper to get stats in old format from new organization stats
   */
  static mapOrganizationStatsToMerchantStats(orgStats: any) {
    if (!orgStats.merchantStats) {
      return null
    }

    return {
      totalTabs: orgStats.merchantStats.total_tabs,
      openTabs: orgStats.merchantStats.open_tabs,
      paidTabs: orgStats.merchantStats.paid_tabs,
      totalRevenue: orgStats.merchantStats.total_revenue,
      outstandingAmount: orgStats.merchantStats.outstanding_amount
    }
  }
}