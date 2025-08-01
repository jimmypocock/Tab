import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { BillingGroupDeletionService } from '@/lib/services/billing-group-deletion.service'
import { logger } from '@/lib/logger'

// GET /api/v1/tabs/:id/default-billing-group - Get or create default billing group for a tab
export const GET = withApiAuth(async (req, context, { params }) => {
  try {
    const { id: tabId } = params
    
    // Get or create the default billing group
    const defaultGroupId = await BillingGroupDeletionService.getOrCreateDefaultBillingGroup(
      tabId,
      context.organizationId
    )

    return NextResponse.json({
      defaultBillingGroupId: defaultGroupId
    })
  } catch (error: any) {
    logger.error('Error getting default billing group', { 
      error, 
      tabId: params.id, 
      organizationId: context.organizationId 
    })

    // Handle specific error types
    if (error.message && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Tab not found' },
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
      { error: 'Failed to get default billing group' },
      { status: 500 }
    )
  }
})