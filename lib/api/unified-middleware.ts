import { NextRequest } from 'next/server'
import { ApiContext, validateApiKey, withApiAuth } from './middleware'

/**
 * Unified middleware that handles both merchant and corporate API access
 * based on the API key's scope and organization capabilities
 */

export interface UnifiedApiContext extends ApiContext {
  organization: {
    id: string
    name: string
    isMerchant: boolean
    isCorporate: boolean
    features: Record<string, any>
  }
  scope: 'merchant' | 'corporate' | 'full'
}

/**
 * Enhanced middleware that loads organization details and checks capabilities
 */
export async function withUnifiedAuth(
  request: NextRequest,
  handler: (request: NextRequest, context: UnifiedApiContext) => Promise<Response>,
  requiredScope?: 'merchant' | 'corporate' | 'full'
): Promise<Response> {
  // Use existing auth middleware
  return withApiAuth(request, async (req, baseContext) => {
    // Load organization details
    const { db } = await import('@/lib/db/client')
    const organization = await db.query.organizations.findFirst({
      where: (orgs, { eq }) => eq(orgs.id, baseContext.organizationId),
    })

    if (!organization) {
      throw new Error('Organization not found')
    }

    // Load API key scope
    const apiKey = await db.query.apiKeys.findFirst({
      where: (keys, { eq }) => eq(keys.id, baseContext.apiKeyId),
      columns: {
        scope: true,
      },
    })

    const scope = (apiKey?.scope || 'merchant') as UnifiedApiContext['scope']

    // Check scope requirements
    if (requiredScope) {
      if (requiredScope === 'merchant' && !organization.isMerchant) {
        throw new Error('This endpoint requires merchant access')
      }
      if (requiredScope === 'corporate' && !organization.isCorporate) {
        throw new Error('This endpoint requires corporate access')
      }
      if (scope !== 'full' && scope !== requiredScope) {
        throw new Error(`API key scope '${scope}' does not have access to this endpoint`)
      }
    }

    // Create enhanced context
    const unifiedContext: UnifiedApiContext = {
      ...baseContext,
      organization: {
        id: organization.id,
        name: organization.name,
        isMerchant: organization.isMerchant || false,
        isCorporate: organization.isCorporate || false,
        features: organization.features as Record<string, any> || {},
      },
      scope,
    }

    // Log activity
    const { organizationActivity } = await import('@/lib/db/schema')
    await db.insert(organizationActivity).values({
      organizationId: organization.id,
      userId: null, // API requests don't have a user
      action: 'api_request',
      entityType: 'api',
      metadata: {
        method: request.method,
        path: new URL(request.url).pathname,
        scope,
      },
    })

    return handler(req, unifiedContext)
  })
}

/**
 * Check if organization has a specific feature enabled
 */
export function hasFeature(
  context: UnifiedApiContext,
  feature: string
): boolean {
  return context.organization.features[feature] === true
}

/**
 * Example: Corporate tab creation with the unified model
 */
export async function createCorporateTab(
  context: UnifiedApiContext,
  merchantOrgId: string,
  tabData: any
) {
  // Check if organization can make corporate purchases
  if (!context.organization.isCorporate || !hasFeature(context, 'cross_merchant_purchasing')) {
    throw new Error('Organization does not have cross-merchant purchasing enabled')
  }

  // Check if there's a relationship with the merchant
  const { db } = await import('@/lib/db/client')
  const relationship = await db.query.organizationRelationships.findFirst({
    where: (rels, { and, eq }) => and(
      eq(rels.corporateOrgId, context.organizationId),
      eq(rels.merchantOrgId, merchantOrgId),
      eq(rels.status, 'active')
    ),
  })

  if (!relationship) {
    throw new Error('No active relationship with this merchant')
  }

  // Create tab with corporate context
  const { tabs } = await import('@/lib/db/schema')
  const tab = await db.insert(tabs).values({
    organizationId: merchantOrgId, // Merchant receiving payment
    customerOrganizationId: context.organizationId, // Corporate buyer
    relationshipId: relationship.id,
    ...tabData,
    // Apply corporate discount if available
    discountAmount: relationship.discountPercentage 
      ? (tabData.subtotal * Number(relationship.discountPercentage) / 100)
      : 0,
  })

  // Log activity
  await db.insert(organizationActivity).values({
    organizationId: context.organizationId,
    action: 'corporate_tab_created',
    entityType: 'tab',
    entityId: tab.id,
    metadata: {
      merchantOrgId,
      amount: tabData.totalAmount,
      discount: relationship.discountPercentage,
    },
  })

  return tab
}