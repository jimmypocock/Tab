import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { z } from 'zod'
import { BillingGroupService } from '@/lib/services/billing-group.service'
import { logger } from '@/lib/logger'

// Validation schemas
const updateBillingGroupSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: z.enum(['active', 'closed', 'suspended']).optional(),
  credit_limit: z.number().positive().optional(),
  deposit_amount: z.number().positive().optional(),
  authorization_code: z.string().optional(),
  po_number: z.string().optional(),
  metadata: z.record(z.any()).optional(),
})

// GET /api/v1/billing-groups/:id - Get a billing group
export const GET = withApiAuth(async (req, context, { params }) => {
  try {
    const { id } = params
    const { searchParams } = new URL(req.url)
    
    const includeRules = searchParams.get('include_rules') === 'true'
    const includeLineItems = searchParams.get('include_line_items') === 'true'
    
    const billingGroup = await BillingGroupService.getBillingGroupById(id, {
      includeRules,
      includeLineItems,
    })
    
    if (!billingGroup) {
      return NextResponse.json(
        { error: 'Billing group not found' },
        { status: 404 }
      )
    }
    
    // TODO: Verify organization has access to this billing group
    
    return NextResponse.json({ billing_group: billingGroup })
  } catch (error) {
    logger.error('Error fetching billing group', { error, billingGroupId: params.id, organizationId: context.organizationId })
    return NextResponse.json(
      { error: 'Failed to fetch billing group' },
      { status: 500 }
    )
  }
})

// PUT /api/v1/billing-groups/:id - Update a billing group
export const PUT = withApiAuth(async (req, context, { params }) => {
  try {
    const { id } = params
    const body = await req.json()
    const validatedData = updateBillingGroupSchema.parse(body)
    
    // TODO: Verify organization has access to this billing group
    
    const updates: any = {
      ...validatedData,
    }
    
    if (validatedData.credit_limit !== undefined) {
      updates.creditLimit = validatedData.credit_limit.toString()
    }
    if (validatedData.deposit_amount !== undefined) {
      updates.depositAmount = validatedData.deposit_amount.toString()
    }
    
    delete updates.credit_limit
    delete updates.deposit_amount
    
    const billingGroup = await BillingGroupService.updateBillingGroup(id, updates)
    
    return NextResponse.json({ billing_group: billingGroup })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    
    logger.error('Error updating billing group', { error, billingGroupId: params.id, organizationId: context.organizationId })
    return NextResponse.json(
      { error: 'Failed to update billing group' },
      { status: 500 }
    )
  }
})

// DELETE /api/v1/billing-groups/:id - Delete a billing group
export const DELETE = withApiAuth(async (req, context, { params }) => {
  try {
    const { id } = params
    
    // TODO: Implement deletion logic
    // Should check if there are any line items assigned
    // Should handle reassignment or prevent deletion
    
    return NextResponse.json(
      { error: 'Billing group deletion not yet implemented' },
      { status: 501 }
    )
  } catch (error) {
    logger.error('Error deleting billing group', { error, billingGroupId: params.id, organizationId: context.organizationId })
    return NextResponse.json(
      { error: 'Failed to delete billing group' },
      { status: 500 }
    )
  }
})