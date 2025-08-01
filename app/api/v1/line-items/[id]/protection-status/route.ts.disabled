import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { LineItemCrudService } from '@/lib/services/line-item-crud.service'
import { logger } from '@/lib/logger'

// GET /api/v1/line-items/[id]/protection-status - Check payment protection status
export const GET = withApiAuth(async (req, context, { params }) => {
  try {
    const { id: lineItemId } = params
    
    const protectionStatus = await LineItemCrudService.checkPaymentProtection(
      lineItemId,
      context.organizationId
    )

    return NextResponse.json({
      data: protectionStatus
    })
  } catch (error: any) {
    logger.error('Error checking line item protection status', { 
      error, 
      lineItemId: params.id, 
      organizationId: context.organizationId 
    })

    if (error.message && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Line item not found' },
        { status: 404 }
      )
    }

    if (error.message && error.message.includes('access')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to check protection status' },
      { status: 500 }
    )
  }
})