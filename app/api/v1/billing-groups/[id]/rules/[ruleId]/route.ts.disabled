import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { BillingGroupService } from '@/lib/services/billing-group.service'
import { withApiAuth } from '@/lib/api/middleware'
import { logger } from '@/lib/logger'

const updateRuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  priority: z.number().min(1).max(1000).optional(),
  conditions: z.object({
    category: z.array(z.string()).optional(),
    amount: z.object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
    }).optional(),
    time: z.object({
      start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
      end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    }).optional(),
    day_of_week: z.array(z.number().min(0).max(6)).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }).optional(),
  action: z.enum(['auto_assign', 'require_approval', 'notify', 'reject']).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  is_active: z.boolean().optional(),
})

export const PUT = withApiAuth(async (
  request: NextRequest,
  context: any,
  { params }: { params: { id: string; ruleId: string } }
) => {
  try {
    const billingGroupId = params.id
    const ruleId = params.ruleId
    
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
    const validatedData = updateRuleSchema.parse(body)

    // Transform conditions to match database schema
    const transformedData = {
      ...validatedData,
      conditions: validatedData.conditions ? {
        ...validatedData.conditions,
        dayOfWeek: validatedData.conditions.day_of_week,
        day_of_week: undefined,
      } : undefined,
      isActive: validatedData.is_active,
      is_active: undefined,
    }

    // Update the rule
    const updatedRule = await BillingGroupService.updateRule(ruleId, transformedData)

    logger.info('Updated billing group rule', {
      billingGroupId,
      ruleId,
      updates: Object.keys(validatedData),
    })

    return NextResponse.json({ rule: updatedRule })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    logger.error('Update rule error', { error })
    return NextResponse.json(
      { error: 'Failed to update rule' },
      { status: 500 }
    )
  }
})

export const DELETE = withApiAuth(async (
  request: NextRequest,
  context: any,
  { params }: { params: { id: string; ruleId: string } }
) => {
  try {
    const billingGroupId = params.id
    const ruleId = params.ruleId
    
    // Verify billing group exists
    const billingGroup = await BillingGroupService.getBillingGroupById(billingGroupId)
    if (!billingGroup) {
      return NextResponse.json(
        { error: 'Billing group not found' },
        { status: 404 }
      )
    }

    // Delete the rule
    await BillingGroupService.deleteRule(ruleId)

    logger.info('Deleted billing group rule', {
      billingGroupId,
      ruleId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Delete rule error', { error })
    return NextResponse.json(
      { error: 'Failed to delete rule' },
      { status: 500 }
    )
  }
})
