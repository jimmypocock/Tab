import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { z } from 'zod'
import { BillingGroupService } from '@/lib/services/billing-group.service'
import { db } from '@/lib/db'
import { lineItems, tabs } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'

// Validation schema
const bulkAssignSchema = z.object({
  assignments: z.array(z.object({
    line_item_id: z.string().uuid(),
    billing_group_id: z.string().uuid(),
  })).min(1).max(100),
})

// POST /api/v1/line-items/bulk-assign - Bulk assign line items to billing groups
export const POST = withApiAuth(async (req, context) => {
  try {
    const body = await req.json()
    const validatedData = bulkAssignSchema.parse(body)
    
    // Extract all line item IDs
    const lineItemIds = validatedData.assignments.map(a => a.line_item_id)
    
    // Verify all line items exist and belong to the organization
    const existingLineItems = await db
      .select({
        id: lineItems.id,
        tabId: lineItems.tabId,
        organizationId: tabs.organizationId,
      })
      .from(lineItems)
      .innerJoin(tabs, eq(lineItems.tabId, tabs.id))
      .where(and(
        inArray(lineItems.id, lineItemIds),
        eq(tabs.organizationId, context.organizationId)
      ))
    
    if (existingLineItems.length !== lineItemIds.length) {
      const foundIds = existingLineItems.map(li => li.id)
      const missingIds = lineItemIds.filter(id => !foundIds.includes(id))
      
      return NextResponse.json(
        { 
          error: 'Some line items not found or unauthorized',
          missing_ids: missingIds,
        },
        { status: 400 }
      )
    }
    
    // Get current user ID for override tracking
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    // Perform bulk assignment
    await BillingGroupService.bulkAssignLineItems(
      validatedData.assignments,
      user?.id
    )
    
    return NextResponse.json({ 
      message: 'Line items assigned successfully',
      assignments_count: validatedData.assignments.length,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    
    logger.error('Error bulk assigning line items', { error, organizationId: context.organizationId })
    return NextResponse.json(
      { error: 'Failed to bulk assign line items' },
      { status: 500 }
    )
  }
})