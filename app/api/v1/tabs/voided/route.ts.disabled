import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { z } from 'zod'
import { TabVoidingService } from '@/lib/services/tab-voiding.service'
import { logger } from '@/lib/logger'

// Query parameters schema
const voidedTabsQuerySchema = z.object({
  limit: z.string().transform(Number).refine(n => n > 0 && n <= 100).optional(),
  offset: z.string().transform(Number).refine(n => n >= 0).optional(),
  dateFrom: z.string().datetime().transform(s => new Date(s)).optional(),
  dateTo: z.string().datetime().transform(s => new Date(s)).optional(),
})

// GET /api/v1/tabs/voided - Get all voided tabs for organization
export const GET = withApiAuth(async (req, context, { params }) => {
  try {
    const { searchParams } = new URL(req.url)
    
    // Parse query parameters
    const queryValidation = voidedTabsQuerySchema.safeParse({
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
      dateFrom: searchParams.get('dateFrom'),
      dateTo: searchParams.get('dateTo'),
    })

    if (!queryValidation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryValidation.error.issues },
        { status: 400 }
      )
    }

    const options = queryValidation.data

    // Get voided tabs
    const result = await TabVoidingService.getVoidedTabs(
      context.organizationId,
      options
    )

    // Calculate summary statistics
    const summary = {
      totalVoidedTabs: result.total,
      totalVoidedAmount: result.tabs.reduce((sum, tab) => sum + parseFloat(tab.totalAmount), 0),
      averageTabAmount: result.tabs.length > 0 
        ? result.tabs.reduce((sum, tab) => sum + parseFloat(tab.totalAmount), 0) / result.tabs.length 
        : 0,
      totalLineItems: result.tabs.reduce((sum, tab) => sum + tab.lineItemsCount, 0),
    }

    return NextResponse.json({
      data: result.tabs,
      pagination: {
        total: result.total,
        limit: options.limit || 50,
        offset: options.offset || 0,
        hasMore: (options.offset || 0) + result.tabs.length < result.total
      },
      summary
    })
  } catch (error: any) {
    logger.error('Error getting voided tabs', { 
      error, 
      organizationId: context.organizationId 
    })

    if (error.message && error.message.includes('Validation')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to get voided tabs' },
      { status: 500 }
    )
  }
})