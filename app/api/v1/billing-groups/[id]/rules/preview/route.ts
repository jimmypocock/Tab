import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { BillingGroupService } from '@/lib/services/billing-group.service'
import { withApiAuth } from '@/lib/api/middleware'
import { db } from '@/lib/db'
import { lineItems, billingGroups } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { logger } from '@/lib/logger'

const previewSchema = z.object({
  conditions: z.object({
    category: z.array(z.string()).optional(),
    amount: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
    }).optional(),
    time: z.object({
      start: z.string().optional(),
      end: z.string().optional(),
    }).optional(),
    dayOfWeek: z.array(z.number().min(0).max(6)).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }),
  action: z.enum(['auto_assign', 'require_approval', 'notify', 'reject']),
  priority: z.number().min(1).max(1000),
})

export const POST = withApiAuth(async (
  request: NextRequest,
  context: any,
  { params }: { params: { id: string } }
) => {
  try {
    const billingGroupId = params.id
    
    // Verify billing group exists
    const billingGroup = await BillingGroupService.getBillingGroupById(billingGroupId)
    if (!billingGroup) {
      return NextResponse.json(
        { error: 'Billing group not found' },
        { status: 404 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = previewSchema.parse(body)

    // Get the tab ID from the billing group
    const tabId = billingGroup.tabId
    if (!tabId) {
      return NextResponse.json(
        { error: 'Billing group is not associated with a tab' },
        { status: 400 }
      )
    }

    // Get all line items from the tab
    const tabLineItems = await db
      .select()
      .from(lineItems)
      .where(eq(lineItems.tabId, tabId))

    // Evaluate rule conditions against each line item
    const matchingItems = []
    const nonMatchingItems = []

    for (const item of tabLineItems) {
      const matches = evaluateRuleConditions(item, validatedData.conditions)
      if (matches) {
        matchingItems.push(item)
      } else {
        nonMatchingItems.push(item)
      }
    }

    // Calculate estimated impact
    const totalAmount = matchingItems.reduce((sum, item) => {
      return sum + (parseFloat(item.unitPrice) * item.quantity)
    }, 0)

    const result = {
      matchingItems: matchingItems.slice(0, 10), // Limit to first 10 for preview
      nonMatchingItems: nonMatchingItems.slice(0, 5), // Limit to first 5 for preview
      totalMatches: matchingItems.length,
      estimatedImpact: {
        itemsAffected: matchingItems.length,
        totalAmount,
      },
    }

    logger.info('Generated rule preview', {
      billingGroupId,
      tabId,
      totalItems: tabLineItems.length,
      matchingItems: matchingItems.length,
      totalAmount,
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    logger.error('Rule preview error', { error })
    return NextResponse.json(
      { error: 'Failed to preview rule' },
      { status: 500 }
    )
  }
})

/**
 * Evaluate if a line item matches rule conditions
 */
function evaluateRuleConditions(
  lineItem: any,
  conditions: any
): boolean {
  // Check category
  if (conditions.category && conditions.category.length > 0) {
    const itemCategory = lineItem.metadata?.category
    if (!itemCategory || !conditions.category.includes(itemCategory)) {
      return false
    }
  }
  
  // Check amount range
  if (conditions.amount) {
    const itemAmount = parseFloat(lineItem.unitPrice) * lineItem.quantity
    if (conditions.amount.min !== undefined && itemAmount < conditions.amount.min) {
      return false
    }
    if (conditions.amount.max !== undefined && itemAmount > conditions.amount.max) {
      return false
    }
  }
  
  // Check time range (using current time for simulation)
  if (conditions.time) {
    const now = new Date()
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    
    if (conditions.time.start && currentTime < conditions.time.start) {
      return false
    }
    if (conditions.time.end && currentTime > conditions.time.end) {
      return false
    }
  }
  
  // Check day of week (using current day for simulation)
  if (conditions.dayOfWeek && conditions.dayOfWeek.length > 0) {
    const currentDay = new Date().getDay()
    if (!conditions.dayOfWeek.includes(currentDay)) {
      return false
    }
  }
  
  // Check metadata
  if (conditions.metadata) {
    for (const [key, value] of Object.entries(conditions.metadata)) {
      if (lineItem.metadata?.[key] !== value) {
        return false
      }
    }
  }
  
  // All conditions passed
  return true
}
