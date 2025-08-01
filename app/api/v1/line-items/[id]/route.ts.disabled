import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { z } from 'zod'
import { LineItemCrudService } from '@/lib/services/line-item-crud.service'
import { db } from '@/lib/db'
import { apiKeys } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'

// Validation schemas
const updateLineItemSchema = z.object({
  description: z.string().min(1).max(500).optional(),
  quantity: z.number().int().positive().optional(),
  unitPrice: z.number().positive().optional(),
  billingGroupId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.any()).optional(),
  force: z.boolean().optional().default(false),
})

const deleteLineItemSchema = z.object({
  force: z.boolean().optional().default(false),
})

// GET /api/v1/line-items/[id] - Get line item with protection info
export const GET = withApiAuth(async (req, context, { params }) => {
  try {
    const { id: lineItemId } = params
    
    const lineItem = await LineItemCrudService.getLineItemWithProtection(
      lineItemId,
      context.organizationId
    )

    return NextResponse.json({
      data: lineItem
    })
  } catch (error: any) {
    logger.error('Error getting line item', { 
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
      { error: 'Failed to get line item' },
      { status: 500 }
    )
  }
})

// PUT /api/v1/line-items/[id] - Update line item
export const PUT = withApiAuth(async (req, context, { params }) => {
  try {
    const { id: lineItemId } = params
    
    // Parse request body
    const body = await req.json()
    const validation = updateLineItemSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.issues },
        { status: 400 }
      )
    }

    const { force, ...updateData } = validation.data

    // Get user ID from API key
    const apiKey = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.id, context.apiKeyId),
      columns: { createdBy: true }
    })
    const userId = apiKey?.createdBy || 'system'

    // Update line item
    const updatedLineItem = await LineItemCrudService.updateLineItem(
      lineItemId,
      updateData,
      context.organizationId,
      userId,
      { force }
    )

    return NextResponse.json({
      data: updatedLineItem,
      message: 'Line item updated successfully'
    })
  } catch (error: any) {
    logger.error('Error updating line item', { 
      error, 
      lineItemId: params.id, 
      organizationId: context.organizationId 
    })

    if (error.message && error.message.includes('Cannot edit line item')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      )
    }

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

    if (error.message && error.message.includes('Validation')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update line item' },
      { status: 500 }
    )
  }
})

// DELETE /api/v1/line-items/[id] - Delete line item
export const DELETE = withApiAuth(async (req, context, { params }) => {
  try {
    const { id: lineItemId } = params
    
    // Parse request body for options
    let options = { force: false }
    try {
      const body = await req.json()
      const validation = deleteLineItemSchema.safeParse(body)
      if (validation.success) {
        options = validation.data
      }
    } catch {
      // Empty body is OK - use defaults
    }

    // Get user ID from API key
    const apiKey = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.id, context.apiKeyId),
      columns: { createdBy: true }
    })
    const userId = apiKey?.createdBy || 'system'

    // Delete line item
    await LineItemCrudService.deleteLineItem(
      lineItemId,
      context.organizationId,
      userId,
      options
    )

    return NextResponse.json({
      message: 'Line item deleted successfully'
    })
  } catch (error: any) {
    logger.error('Error deleting line item', { 
      error, 
      lineItemId: params.id, 
      organizationId: context.organizationId 
    })

    if (error.message && error.message.includes('Cannot delete line item')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      )
    }

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
      { error: 'Failed to delete line item' },
      { status: 500 }
    )
  }
})