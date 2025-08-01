import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { BillingGroupsAnalyticsService } from '@/lib/services/billing-groups-analytics.service'
import { withApiAuth } from '@/lib/api/middleware'
import { logger } from '@/lib/logger'

const analyticsQuerySchema = z.object({
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  organization_id: z.string().optional(),
})

export const GET = withApiAuth(async (
  request: NextRequest,
  context: any
) => {
  try {
    const { searchParams } = new URL(request.url)
    const queryParams = {
      date_from: searchParams.get('date_from'),
      date_to: searchParams.get('date_to'),
      organization_id: searchParams.get('organization_id'),
    }

    const validatedParams = analyticsQuerySchema.parse(queryParams)

    // Parse dates
    const dateFrom = validatedParams.date_from ? new Date(validatedParams.date_from) : undefined
    const dateTo = validatedParams.date_to ? new Date(validatedParams.date_to) : undefined
    const organizationId = validatedParams.organization_id || context.organizationId

    // Get analytics
    const analytics = await BillingGroupsAnalyticsService.getAnalytics({
      organizationId,
      dateFrom,
      dateTo,
    })

    logger.info('Generated billing groups analytics', {
      organizationId,
      dateFrom,
      dateTo,
      totalGroups: analytics.overview.totalBillingGroups,
    })

    return NextResponse.json({ analytics })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    logger.error('Analytics generation error', { error })
    return NextResponse.json(
      { error: 'Failed to generate analytics' },
      { status: 500 }
    )
  }
})

// Track analytics events
const trackEventSchema = z.object({
  event_type: z.enum(['group_created', 'rule_created', 'item_assigned', 'manual_override', 'payment_processed']),
  billing_group_id: z.string().optional(),
  rule_id: z.string().optional(),
  line_item_id: z.string().optional(),
  amount: z.number().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

export const POST = withApiAuth(async (
  request: NextRequest,
  context: any
) => {
  try {
    const body = await request.json()
    const validatedData = trackEventSchema.parse(body)

    // Track the event
    await BillingGroupsAnalyticsService.trackEvent(
      validatedData.event_type,
      {
        billingGroupId: validatedData.billing_group_id,
        ruleId: validatedData.rule_id,
        lineItemId: validatedData.line_item_id,
        amount: validatedData.amount,
        metadata: validatedData.metadata,
      }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    logger.error('Analytics tracking error', { error })
    return NextResponse.json(
      { error: 'Failed to track event' },
      { status: 500 }
    )
  }
})
