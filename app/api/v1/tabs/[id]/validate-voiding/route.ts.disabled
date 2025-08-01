import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { TabVoidingService } from '@/lib/services/tab-voiding.service'
import { logger } from '@/lib/logger'

// GET /api/v1/tabs/[id]/validate-voiding - Check if tab can be voided
export const GET = withApiAuth(async (req, context, { params }) => {
  try {
    const { id: tabId } = params
    
    // Validate voiding (this will also verify access)
    const validation = await TabVoidingService.validateVoiding(
      tabId,
      context.organizationId
    )

    return NextResponse.json({
      canVoid: validation.canVoid,
      blockers: validation.blockers,
      warnings: validation.warnings,
      tab: validation.tab
    })
  } catch (error: any) {
    logger.error('Error validating tab voiding', { 
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

    if (error.message && error.message.includes('already voided')) {
      return NextResponse.json(
        { error: 'Tab is already voided' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to validate tab voiding' },
      { status: 500 }
    )
  }
})