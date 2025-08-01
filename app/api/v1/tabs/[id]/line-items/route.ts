import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { LineItemCrudService } from '@/lib/services/line-item-crud.service'
import { logger } from '@/lib/logger'

// GET /api/v1/tabs/[id]/line-items - Get all line items for a tab with protection info
export const GET = withApiAuth(async (req, context, { params }) => {
  try {
    const { id: tabId } = params
    
    const lineItems = await LineItemCrudService.getTabLineItems(
      tabId,
      context.organizationId
    )

    // Calculate summary statistics
    const summary = {
      totalItems: lineItems.length,
      totalAmount: lineItems.reduce((sum, item) => sum + parseFloat(item.total), 0),
      protectedItems: lineItems.filter(item => !item.canEdit).length,
      unprotectedItems: lineItems.filter(item => item.canEdit).length,
      paymentStatus: {
        paid: lineItems.filter(item => item.paymentStatus === 'paid').length,
        partial: lineItems.filter(item => item.paymentStatus === 'partial').length,
        unpaid: lineItems.filter(item => item.paymentStatus === 'unpaid').length,
      }
    }

    return NextResponse.json({
      data: lineItems,
      summary
    })
  } catch (error: any) {
    logger.error('Error getting tab line items', { 
      error, 
      tabId: params.id, 
      organizationId: context.organizationId 
    })

    if (error.message && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Tab not found' },
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
      { error: 'Failed to get line items' },
      { status: 500 }
    )
  }
})