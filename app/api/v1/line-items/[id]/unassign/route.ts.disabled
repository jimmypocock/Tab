import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { db } from '@/lib/db'
import { lineItems, tabs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'

// POST /api/v1/line-items/:id/unassign - Remove a line item from its billing group
export const POST = withApiAuth(async (req, context, { params }) => {
  try {
    const { id: lineItemId } = params
    
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
    
    if (!lineItem.billingGroupId) {
      return NextResponse.json(
        { error: 'Line item is not assigned to any billing group' },
        { status: 400 }
      )
    }
    
    // Unassign the line item
    await db
      .update(lineItems)
      .set({
        billingGroupId: null,
        updatedAt: new Date(),
      })
      .where(eq(lineItems.id, lineItemId))
    
    logger.info('Unassigned line item from billing group', { 
      lineItemId, 
      previousGroupId: lineItem.billingGroupId 
    })
    
    return NextResponse.json({ 
      message: 'Line item unassigned successfully',
      line_item_id: lineItemId,
    })
  } catch (error) {
    logger.error('Error unassigning line item', { error, lineItemId: params.id, organizationId: context.organizationId })
    return NextResponse.json(
      { error: 'Failed to unassign line item' },
      { status: 500 }
    )
  }
})