import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { z } from 'zod'
import { BillingGroupService } from '@/lib/services/billing-group.service'
import { BillingGroupDeletionService } from '@/lib/services/billing-group-deletion.service'
import { db } from '@/lib/db'
import { apiKeys } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
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

const deleteBillingGroupSchema = z.object({
  moveLineItemsToGroupId: z.string().uuid().optional(),
  force: z.boolean().optional().default(false),
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
    const { id: billingGroupId } = params
    
    // Parse request body for deletion options
    let deleteOptions = {}
    try {
      const body = await req.json()
      const validation = deleteBillingGroupSchema.safeParse(body)
      if (validation.success) {
        deleteOptions = validation.data
      } else {
        return NextResponse.json(
          { error: 'Invalid deletion options', details: validation.error.errors },
          { status: 400 }
        )
      }
    } catch {
      // Empty body is OK - use defaults
    }

    // First, validate if deletion is possible
    const validation = await BillingGroupDeletionService.validateDeletion(
      billingGroupId,
      context.organizationId
    )

    // If force=true and user is admin, skip validation
    const isForced = (deleteOptions as any).force === true
    if (!validation.canDelete && !isForced) {
      return NextResponse.json(
        { 
          error: 'Cannot delete billing group',
          blockers: validation.blockers,
          warnings: validation.warnings,
          billingGroup: validation.billingGroup
        },
        { status: 409 }
      )
    }

    // If using moveLineItemsToGroupId, validate the target group exists
    const moveLineItemsToGroupId = (deleteOptions as any).moveLineItemsToGroupId
    if (moveLineItemsToGroupId) {
      const targetGroup = await BillingGroupService.getBillingGroupById(moveLineItemsToGroupId)
      if (!targetGroup) {
        return NextResponse.json(
          { error: 'Target billing group for line items not found' },
          { status: 400 }
        )
      }
    }

    // Get the API key to find the user ID
    const apiKey = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.id, context.apiKeyId),
      columns: { createdBy: true }
    })

    const userId = apiKey?.createdBy || 'system'

    // Perform the deletion
    await BillingGroupDeletionService.deleteBillingGroup(
      billingGroupId,
      context.organizationId,
      userId,
      {
        skipValidation: isForced,
        moveLineItemsToGroupId
      }
    )

    return NextResponse.json({
      message: 'Billing group deleted successfully',
      warnings: validation.warnings
    })
  } catch (error: any) {
    logger.error('Error deleting billing group', { 
      error, 
      billingGroupId: params.id, 
      organizationId: context.organizationId 
    })

    // Handle specific error types
    if (error.message && error.message.includes('Cannot delete billing group')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      )
    }

    if (error.message && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Billing group not found' },
        { status: 404 }
      )
    }

    if (error.message && error.message.includes('permission')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to delete billing group' },
      { status: 500 }
    )
  }
})