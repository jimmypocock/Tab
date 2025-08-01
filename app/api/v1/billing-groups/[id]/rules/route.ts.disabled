import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { z } from 'zod'
import { BillingGroupService } from '@/lib/services/billing-group.service'
import { logger } from '@/lib/logger'

// Validation schemas
const createRuleSchema = z.object({
  name: z.string().min(1).max(255),
  priority: z.number().int().min(0).default(100),
  conditions: z.object({
    category: z.array(z.string()).optional(),
    amount: z.object({
      min: z.number().positive().optional(),
      max: z.number().positive().optional(),
    }).optional(),
    time: z.object({
      start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    }).optional(),
    day_of_week: z.array(z.number().int().min(0).max(6)).optional(),
    metadata: z.record(z.any()).optional(),
  }),
  action: z.enum(['auto_assign', 'require_approval', 'notify', 'reject']).default('auto_assign'),
  metadata: z.record(z.any()).optional(),
})

// GET /api/v1/billing-groups/:id/rules - List rules for a billing group
export const GET = withApiAuth(async (req, context, { params }) => {
  try {
    const { id: billingGroupId } = params
    
    const billingGroup = await BillingGroupService.getBillingGroupById(billingGroupId, {
      includeRules: true,
    })
    
    if (!billingGroup) {
      return NextResponse.json(
        { error: 'Billing group not found' },
        { status: 404 }
      )
    }
    
    // TODO: Verify organization has access to this billing group
    
    return NextResponse.json({ rules: billingGroup.rules || [] })
  } catch (error) {
    logger.error('Error fetching billing group rules', { error, billingGroupId: params.id, organizationId: context.organizationId })
    return NextResponse.json(
      { error: 'Failed to fetch rules' },
      { status: 500 }
    )
  }
})

// POST /api/v1/billing-groups/:id/rules - Create a rule for a billing group
export const POST = withApiAuth(async (req, context, { params }) => {
  try {
    const { id: billingGroupId } = params
    const body = await req.json()
    const validatedData = createRuleSchema.parse(body)
    
    // Verify billing group exists and organization has access
    const billingGroup = await BillingGroupService.getBillingGroupById(billingGroupId)
    
    if (!billingGroup) {
      return NextResponse.json(
        { error: 'Billing group not found' },
        { status: 404 }
      )
    }
    
    // TODO: Verify organization has access to this billing group
    
    const rule = await BillingGroupService.createRule({
      billingGroupId,
      name: validatedData.name,
      priority: validatedData.priority,
      conditions: {
        category: validatedData.conditions.category,
        amount: validatedData.conditions.amount,
        time: validatedData.conditions.time,
        dayOfWeek: validatedData.conditions.day_of_week,
        metadata: validatedData.conditions.metadata,
      },
      action: validatedData.action,
      metadata: validatedData.metadata,
    })
    
    return NextResponse.json({ rule }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    
    logger.error('Error creating billing group rule', { error, billingGroupId: params.id, organizationId: context.organizationId })
    return NextResponse.json(
      { error: 'Failed to create rule' },
      { status: 500 }
    )
  }
})