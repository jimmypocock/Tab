import { NextRequest, NextResponse } from 'next/server'
import { withCorporateAuth } from '@/lib/api/corporate-middleware'
import { CorporateAccountService } from '@/lib/services/corporate-account.service'
import { db } from '@/lib/db'
import { tabs, lineItems, corporateMerchantRelationships } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { logger } from '@/lib/logger'

// Validation schemas
const createTabSchema = z.object({
  merchant_id: z.string().uuid(),
  customer_email: z.string().email().optional(),
  customer_name: z.string().optional(),
  external_reference: z.string().optional(),
  purchase_order_number: z.string().optional(),
  department: z.string().optional(),
  cost_center: z.string().optional(),
  line_items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number().int().positive(),
      unit_price: z.number().positive(),
    })
  ).min(1),
  metadata: z.record(z.any()).optional(),
})

// GET /api/v1/corporate/tabs - List all tabs for corporate account
export const GET = withCorporateAuth(async (req, context) => {
  try {
    const { corporateAccount } = context
    const { searchParams } = new URL(req.url)
    
    // Parse filters
    const filters = {
      merchantId: searchParams.get('merchant_id') || undefined,
      status: searchParams.get('status') || undefined,
      dateFrom: searchParams.get('date_from') 
        ? new Date(searchParams.get('date_from')!) 
        : undefined,
      dateTo: searchParams.get('date_to')
        ? new Date(searchParams.get('date_to')!)
        : undefined,
    }
    
    // Get tabs with merchant info
    const tabsData = await CorporateAccountService.getCorporateTabs(
      corporateAccount.id,
      filters
    )
    
    // Group by merchant for easier consumption
    const groupedByMerchant = tabsData.reduce((acc, { tab, merchant, relationship }) => {
      if (!acc[merchant.id]) {
        acc[merchant.id] = {
          merchant: {
            id: merchant.id,
            name: merchant.businessName,
            relationship: relationship ? {
              creditLimit: relationship.creditLimit,
              paymentTerms: relationship.paymentTerms,
              discountPercentage: relationship.discountPercentage,
            } : null,
          },
          tabs: [],
        }
      }
      
      acc[merchant.id].tabs.push({
        id: tab.id,
        status: tab.status,
        totalAmount: tab.totalAmount,
        paidAmount: tab.paidAmount,
        customerEmail: tab.customerEmail,
        customerName: tab.customerName,
        purchaseOrderNumber: tab.purchaseOrderNumber,
        department: tab.department,
        costCenter: tab.costCenter,
        createdAt: tab.createdAt,
      })
      
      return acc
    }, {} as Record<string, any>)
    
    return NextResponse.json({
      merchants: Object.values(groupedByMerchant),
      total_tabs: tabsData.length,
    })
  } catch (error) {
    logger.error('Error fetching corporate tabs', { error, corporateAccountId: corporateAccount.id })
    return NextResponse.json(
      { error: 'Failed to fetch tabs' },
      { status: 500 }
    )
  }
})

// POST /api/v1/corporate/tabs - Create a new tab for corporate account
export const POST = withCorporateAuth(async (req, context) => {
  try {
    const { corporateAccount } = context
    const body = await req.json()
    
    // Validate request body
    const validatedData = createTabSchema.parse(body)
    
    // Check if corporate account has relationship with merchant
    const hasAccess = await CorporateAccountService.hasAccessToMerchant(
      corporateAccount.id,
      validatedData.merchant_id
    )
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'No active relationship with this merchant' },
        { status: 403 }
      )
    }
    
    // Get the relationship details
    const [relationship] = await db
      .select()
      .from(corporateMerchantRelationships)
      .where(
        and(
          eq(corporateMerchantRelationships.corporateAccountId, corporateAccount.id),
          eq(corporateMerchantRelationships.merchantId, validatedData.merchant_id),
          eq(corporateMerchantRelationships.status, 'active')
        )
      )
      .limit(1)
    
    // Calculate totals
    const subtotal = validatedData.line_items.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    )
    
    // Apply discount if available
    const discountAmount = relationship.discountPercentage
      ? subtotal * (parseFloat(relationship.discountPercentage) / 100)
      : 0
    
    const totalAmount = subtotal - discountAmount
    
    // Create the tab
    const [newTab] = await db
      .insert(tabs)
      .values({
        merchantId: validatedData.merchant_id,
        corporateAccountId: corporateAccount.id,
        corporateRelationshipId: relationship.id,
        customerEmail: validatedData.customer_email || 
          relationship.billingContactEmail || 
          corporateAccount.primaryContactEmail,
        customerName: validatedData.customer_name || corporateAccount.companyName,
        externalReference: validatedData.external_reference,
        purchaseOrderNumber: validatedData.purchase_order_number,
        department: validatedData.department,
        costCenter: validatedData.cost_center,
        subtotal: subtotal.toFixed(2),
        taxAmount: '0.00', // Would be calculated based on merchant settings
        totalAmount: totalAmount.toFixed(2),
        metadata: {
          ...validatedData.metadata,
          corporate_discount_applied: discountAmount > 0 ? discountAmount : undefined,
        },
      })
      .returning()
    
    // Create line items
    if (validatedData.line_items.length > 0) {
      await db.insert(lineItems).values(
        validatedData.line_items.map(item => ({
          tabId: newTab.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unit_price.toFixed(2),
          total: (item.quantity * item.unit_price).toFixed(2),
        }))
      )
    }
    
    // Log activity
    await CorporateAccountService.logActivity({
      corporateAccountId: corporateAccount.id,
      merchantId: validatedData.merchant_id,
      action: 'tab_created',
      entityType: 'tab',
      entityId: newTab.id,
      metadata: {
        purchase_order_number: validatedData.purchase_order_number,
        department: validatedData.department,
        total_amount: totalAmount,
      },
    })
    
    return NextResponse.json({
      tab: {
        id: newTab.id,
        status: newTab.status,
        totalAmount: newTab.totalAmount,
        customerEmail: newTab.customerEmail,
        purchaseOrderNumber: newTab.purchaseOrderNumber,
        createdAt: newTab.createdAt,
      },
      message: 'Tab created successfully',
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    
    logger.error('Error creating corporate tab', { error, corporateAccountId: corporateAccount.id, merchantId: validatedData.merchant_id })
    return NextResponse.json(
      { error: 'Failed to create tab' },
      { status: 500 }
    )
  }
})