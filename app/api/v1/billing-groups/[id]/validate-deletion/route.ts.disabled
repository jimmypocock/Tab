import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { BillingGroupDeletionService } from '@/lib/services/billing-group-deletion.service'
import { logger } from '@/lib/logger'

// GET /api/v1/billing-groups/:id/validate-deletion - Check if billing group can be deleted
export const GET = withApiAuth(async (req, context, { params }) => {
  try {
    const { id: billingGroupId } = params
    
    // Validate deletion (this will also verify access)
    const validation = await BillingGroupDeletionService.validateDeletion(
      billingGroupId,
      context.organizationId
    )

    return NextResponse.json({
      canDelete: validation.canDelete,
      blockers: validation.blockers,
      warnings: validation.warnings,
      billingGroup: validation.billingGroup
    })
  } catch (error: any) {
    logger.error('Error validating billing group deletion', { 
      error, 
      billingGroupId: params.id, 
      organizationId: context.organizationId 
    })

    // Handle specific error types
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
      { error: 'Failed to validate billing group deletion' },
      { status: 500 }
    )
  }
})