import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { BillingGroupsAuditService } from '@/lib/services/billing-groups-audit.service'
import { withApiAuth } from '@/lib/api/middleware'
import { logger } from '@/lib/logger'

const auditQuerySchema = z.object({
  entity_type: z.enum(['billing_group', 'billing_group_rule', 'line_item_assignment']).optional(),
  entity_id: z.string().optional(),
  action: z.string().optional(),
  user_id: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  search: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
  export: z.enum(['csv']).optional(),
})

export const GET = withApiAuth(async (
  request: NextRequest,
  context: any
) => {
  try {
    const { searchParams } = new URL(request.url)
    const queryParams = {
      entity_type: searchParams.get('entity_type'),
      entity_id: searchParams.get('entity_id'),
      action: searchParams.get('action'),
      user_id: searchParams.get('user_id'),
      date_from: searchParams.get('date_from'),
      date_to: searchParams.get('date_to'),
      search: searchParams.get('search'),
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
      export: searchParams.get('export'),
    }

    const validatedParams = auditQuerySchema.parse(queryParams)

    // Parse parameters
    const query = {
      entityType: validatedParams.entity_type,
      entityId: validatedParams.entity_id,
      action: validatedParams.action,
      userId: validatedParams.user_id,
      dateFrom: validatedParams.date_from ? new Date(validatedParams.date_from) : undefined,
      dateTo: validatedParams.date_to ? new Date(validatedParams.date_to) : undefined,
      search: validatedParams.search,
      limit: validatedParams.limit ? parseInt(validatedParams.limit) : undefined,
      offset: validatedParams.offset ? parseInt(validatedParams.offset) : undefined,
    }

    // Handle export
    if (validatedParams.export === 'csv') {
      const csvContent = await BillingGroupsAuditService.exportAuditTrail(query)
      
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="billing-groups-audit-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    // Regular query
    const result = await BillingGroupsAuditService.queryAuditTrail(query)

    logger.info('Queried billing groups audit trail', {
      query,
      totalCount: result.totalCount,
      returnedCount: result.events.length,
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    logger.error('Audit trail query error', { error })
    return NextResponse.json(
      { error: 'Failed to query audit trail' },
      { status: 500 }
    )
  }
})

// Record audit event
const recordEventSchema = z.object({
  entity_type: z.enum(['billing_group', 'billing_group_rule', 'line_item_assignment']),
  entity_id: z.string(),
  action: z.enum(['created', 'updated', 'deleted', 'assigned', 'unassigned', 'override']),
  user_id: z.string(),
  user_email: z.string().optional(),
  changes: z.record(z.string(), z.object({
    from: z.any(),
    to: z.any(),
  })).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  ip_address: z.string().optional(),
  user_agent: z.string().optional(),
})

export const POST = withApiAuth(async (
  request: NextRequest,
  context: any
) => {
  try {
    const body = await request.json()
    const validatedData = recordEventSchema.parse(body)

    // Get client IP and user agent
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     validatedData.ip_address
    const userAgent = request.headers.get('user-agent') || validatedData.user_agent

    // Record the event
    const event = await BillingGroupsAuditService.recordEvent({
      entityType: validatedData.entity_type,
      entityId: validatedData.entity_id,
      action: validatedData.action,
      userId: validatedData.user_id,
      userEmail: validatedData.user_email,
      changes: validatedData.changes,
      metadata: validatedData.metadata,
      ipAddress,
      userAgent,
    })

    logger.info('Recorded audit event', {
      eventId: event.id,
      entityType: event.entityType,
      action: event.action,
    })

    return NextResponse.json({ event }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    logger.error('Audit event recording error', { error })
    return NextResponse.json(
      { error: 'Failed to record audit event' },
      { status: 500 }
    )
  }
})
