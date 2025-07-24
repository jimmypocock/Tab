import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { z } from 'zod'
import { BillingGroupService } from '@/lib/services/billing-group.service'
import { db } from '@/lib/db'
import { lineItems, tabs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'

// Validation schema
const assignLineItemSchema = z.object({
  billing_group_id: z.string().uuid(),
  reason: z.string().optional(),
})

// POST /api/v1/line-items/:id/assign - Assign a line item to a billing group
export const POST = withApiAuth(async (req, context, { params }) => {
  try {
    const { id: lineItemId } = params
    const body = await req.json()
    const validatedData = assignLineItemSchema.parse(body)
    
    // Get the line item and verify access
    const [lineItem] = await db
      .select({
        id: lineItems.id,
        tabId: lineItems.tabId,
        billingGroupId: lineItems.billingGroupId,
        tab: {
          organizationId: tabs.organizationId,
        },
      })
      .from(lineItems)
      .innerJoin(tabs, eq(lineItems.tabId, tabs.id))
      .where(eq(lineItems.id, lineItemId))
      .limit(1)
    
    if (!lineItem) {
      return NextResponse.json(
        { error: 'Line item not found' },
        { status: 404 }
      )
    }
    
    if (lineItem.tab.organizationId !== context.organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }
    
    // Get current user ID for override tracking
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    // Assign the line item
    await BillingGroupService.assignLineItem(
      lineItemId,
      validatedData.billing_group_id,
      {
        overriddenBy: user?.id,
        reason: validatedData.reason,
      }
    )
    
    return NextResponse.json({ 
      message: 'Line item assigned successfully',
      line_item_id: lineItemId,
      billing_group_id: validatedData.billing_group_id,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    
    logger.error('Error assigning line item', { error, lineItemId: params.id, organizationId: context.organizationId })
    return NextResponse.json(
      { error: 'Failed to assign line item' },
      { status: 500 }
    )
  }
})