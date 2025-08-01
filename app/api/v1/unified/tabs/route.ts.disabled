import { NextRequest } from 'next/server'
import { withUnifiedAuth, hasFeature } from '@/lib/api/unified-middleware'
import { createSuccessResponse, createErrorResponse } from '@/lib/api/response'
import { db } from '@/lib/db/client'
import { tabs, organizationRelationships, lineItems, organizationActivity } from '@/lib/db/schema'
import { and, eq, gte, lte, or, desc, sql } from 'drizzle-orm'
import { z } from 'zod'

/**
 * Unified tabs endpoint that handles both merchant and corporate contexts
 * 
 * For merchants: Shows tabs where they are receiving payment
 * For corporates: Shows tabs where they are the customer
 * For both: Shows all relevant tabs
 */

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.enum(['open', 'partial', 'paid', 'void']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  context: z.enum(['merchant', 'corporate', 'all']).default('all'),
})

export async function GET(request: NextRequest) {
  return withUnifiedAuth(request, async (req, context) => {
    const { searchParams } = new URL(req.url)
    const query = querySchema.parse(Object.fromEntries(searchParams))
    
    const limit = query.limit
    const offset = (query.page - 1) * limit

    // Build WHERE conditions based on context
    const conditions = []
    
    // Determine which tabs to show based on scope and context
    if (query.context === 'merchant' || query.context === 'all') {
      if (context.organization.isMerchant) {
        // Tabs where this org is the merchant
        conditions.push(eq(tabs.organizationId, context.organizationId))
      }
    }
    
    if (query.context === 'corporate' || query.context === 'all') {
      if (context.organization.isCorporate) {
        // Tabs where this org is the customer
        conditions.push(eq(tabs.customerOrganizationId, context.organizationId))
      }
    }

    if (conditions.length === 0) {
      return createSuccessResponse({
        tabs: [],
        pagination: { page: query.page, limit, total: 0, pages: 0 }
      })
    }

    // Add filters
    const filters = []
    if (query.status) filters.push(eq(tabs.status, query.status))
    if (query.from) filters.push(gte(tabs.createdAt, new Date(query.from)))
    if (query.to) filters.push(lte(tabs.createdAt, new Date(query.to)))

    // Query tabs
    const whereClause = and(
      conditions.length > 1 ? or(...conditions) : conditions[0],
      ...filters
    )

    const [tabsData, totalCount] = await Promise.all([
      db.query.tabs.findMany({
        where: whereClause,
        with: {
          organization: {
            columns: {
              id: true,
              name: true,
              slug: true,
            }
          },
          customerOrganization: {
            columns: {
              id: true,
              name: true,
            }
          },
          relationship: {
            columns: {
              creditLimit: true,
              paymentTerms: true,
              discountPercentage: true,
            }
          },
          lineItems: true,
          payments: {
            columns: {
              id: true,
              amount: true,
              status: true,
              createdAt: true,
            }
          }
        },
        orderBy: [desc(tabs.createdAt)],
        limit,
        offset,
      }),
      db.select({ count: sql`count(*)` })
        .from(tabs)
        .where(whereClause)
        .then(result => Number(result[0].count))
    ])

    // Add context to each tab
    const enrichedTabs = tabsData.map(tab => ({
      ...tab,
      context: tab.organizationId === context.organizationId ? 'merchant' : 'corporate',
      relationship: tab.relationship || null,
    }))

    return createSuccessResponse({
      tabs: enrichedTabs,
      pagination: {
        page: query.page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    })
  })
}

const createTabSchema = z.object({
  // For corporate purchases, specify the merchant
  merchantOrganizationId: z.string().uuid().optional(),
  
  // Customer info
  customerEmail: z.string().email(),
  customerName: z.string().optional(),
  
  // Tab details
  externalReference: z.string().optional(),
  currency: z.string().default('USD'),
  
  // Corporate fields
  purchaseOrderNumber: z.string().optional(),
  department: z.string().optional(),
  costCenter: z.string().optional(),
  
  // Line items
  lineItems: z.array(z.object({
    description: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
  })).min(1),
})

export async function POST(request: NextRequest) {
  return withUnifiedAuth(request, async (req, context) => {
    const body = await req.json()
    const data = createTabSchema.parse(body)
    
    // Determine if this is a corporate purchase
    const isCorporatePurchase = data.merchantOrganizationId && 
                               data.merchantOrganizationId !== context.organizationId
    
    if (isCorporatePurchase) {
      // Validate corporate purchasing capability
      if (!context.organization.isCorporate) {
        return createErrorResponse(new Error('Organization cannot make corporate purchases'))
      }
      
      if (!hasFeature(context, 'cross_merchant_purchasing')) {
        return createErrorResponse(new Error('Cross-merchant purchasing is not enabled'))
      }
      
      // Check relationship exists
      const relationship = await db.query.organizationRelationships.findFirst({
        where: and(
          eq(organizationRelationships.corporateOrgId, context.organizationId),
          eq(organizationRelationships.merchantOrgId, data.merchantOrganizationId!),
          eq(organizationRelationships.status, 'active')
        )
      })
      
      if (!relationship) {
        return createErrorResponse(new Error('No active relationship with this merchant'))
      }
      
      // Calculate totals with corporate discount
      const subtotal = data.lineItems.reduce((sum, item) => 
        sum + (item.quantity * item.unitPrice), 0
      )
      
      const discountAmount = relationship.discountPercentage 
        ? subtotal * (Number(relationship.discountPercentage) / 100)
        : 0
      
      // Create corporate tab
      const tab = await db.transaction(async (tx) => {
        const [newTab] = await tx.insert(tabs).values({
          organizationId: data.merchantOrganizationId,
          customerOrganizationId: context.organizationId,
          relationshipId: relationship.id,
          customerEmail: data.customerEmail,
          customerName: data.customerName,
          externalReference: data.externalReference,
          currency: data.currency,
          subtotal: subtotal.toString(),
          discountAmount: discountAmount.toString(),
          totalAmount: (subtotal - discountAmount).toString(),
          purchaseOrderNumber: data.purchaseOrderNumber,
          department: data.department,
          costCenter: data.costCenter,
        }).returning()
        
        // Insert line items
        await tx.insert(lineItems).values(
          data.lineItems.map(item => ({
            tabId: newTab.id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toString(),
            total: (item.quantity * item.unitPrice).toString(),
          }))
        )
        
        // Log activity
        await tx.insert(organizationActivity).values({
          organizationId: context.organizationId,
          action: 'corporate_tab_created',
          entityType: 'tab',
          entityId: newTab.id,
          metadata: {
            merchantOrganizationId: data.merchantOrganizationId,
            amount: newTab.totalAmount,
            discount: discountAmount,
          }
        })
        
        return newTab
      })
      
      return createSuccessResponse({ tab }, 201)
    } else {
      // Regular merchant tab creation
      if (!context.organization.isMerchant) {
        return createErrorResponse(new Error('Organization cannot create merchant tabs'))
      }
      
      // Create regular tab
      const subtotal = data.lineItems.reduce((sum, item) => 
        sum + (item.quantity * item.unitPrice), 0
      )
      
      const tab = await db.transaction(async (tx) => {
        const [newTab] = await tx.insert(tabs).values({
          organizationId: context.organizationId,
          customerEmail: data.customerEmail,
          customerName: data.customerName,
          externalReference: data.externalReference,
          currency: data.currency,
          subtotal: subtotal.toString(),
          totalAmount: subtotal.toString(),
        }).returning()
        
        // Insert line items
        await tx.insert(lineItems).values(
          data.lineItems.map(item => ({
            tabId: newTab.id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toString(),
            total: (item.quantity * item.unitPrice).toString(),
          }))
        )
        
        return newTab
      })
      
      return createSuccessResponse({ tab }, 201)
    }
  })
}