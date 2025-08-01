import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { z } from 'zod'
import { LineItemCrudService } from '@/lib/services/line-item-crud.service'
import { db } from '@/lib/db'
import { apiKeys } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'

// Validation schema
const createLineItemSchema = z.object({
  tabId: z.string().uuid(),
  description: z.string().min(1).max(500),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  billingGroupId: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional(),
})

// POST /api/v1/line-items - Create a new line item
export const POST = withApiAuth(async (req, context, { params }) => {
  try {
    // Parse request body
    const body = await req.json()
    const validation = createLineItemSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      )
    }

    const data = validation.data

    // Get user ID from API key
    const apiKey = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.id, context.apiKeyId),
      columns: { createdBy: true }
    })
    const userId = apiKey?.createdBy || 'system'

    // Create line item
    const newLineItem = await LineItemCrudService.createLineItem(
      data,
      context.organizationId,
      userId
    )

    return NextResponse.json({
      data: newLineItem,
      message: 'Line item created successfully'
    }, { status: 201 })
  } catch (error: any) {
    logger.error('Error creating line item', { 
      error, 
      organizationId: context.organizationId 
    })

    if (error.message && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Tab or billing group not found' },
        { status: 404 }
      )
    }

    if (error.message && error.message.includes('access')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    if (error.message && error.message.includes('Validation')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create line item' },
      { status: 500 }
    )
  }
})