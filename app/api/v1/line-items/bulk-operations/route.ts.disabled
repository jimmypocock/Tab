import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { z } from 'zod'
import { LineItemCrudService } from '@/lib/services/line-item-crud.service'
import { db } from '@/lib/db'
import { apiKeys } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'

// Validation schemas
const bulkUpdateSchema = z.object({
  lineItemIds: z.array(z.string().uuid()).min(1).max(50),
  updates: z.object({
    billingGroupId: z.string().uuid().nullable().optional(),
    metadata: z.record(z.any()).optional(),
  }),
  force: z.boolean().optional().default(false),
})

const bulkDeleteSchema = z.object({
  lineItemIds: z.array(z.string().uuid()).min(1).max(50),
  force: z.boolean().optional().default(false),
})

const bulkProtectionCheckSchema = z.object({
  lineItemIds: z.array(z.string().uuid()).min(1).max(100),
})

// POST /api/v1/line-items/bulk-operations - Perform bulk operations on line items
export const POST = withApiAuth(async (req, context, { params }) => {
  try {
    const body = await req.json()
    const { operation, ...operationData } = body

    // Get user ID from API key
    const apiKey = await db.query.apiKeys.findFirst({
      where: eq(apiKeys.id, context.apiKeyId),
      columns: { createdBy: true }
    })
    const userId = apiKey?.createdBy || 'system'

    switch (operation) {
      case 'update':
        return await handleBulkUpdate(operationData, context.organizationId, userId)
      
      case 'delete':
        return await handleBulkDelete(operationData, context.organizationId, userId)
      
      case 'protection-check':
        return await handleBulkProtectionCheck(operationData, context.organizationId)
      
      default:
        return NextResponse.json(
          { error: 'Invalid operation. Supported operations: update, delete, protection-check' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    logger.error('Error in bulk line item operation', { 
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
      { error: 'Failed to perform bulk operation' },
      { status: 500 }
    )
  }
})

async function handleBulkUpdate(
  data: any,
  organizationId: string,
  userId: string
): Promise<NextResponse> {
  const validation = bulkUpdateSchema.safeParse(data)
  
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Validation error', details: validation.error.issues },
      { status: 400 }
    )
  }

  const { lineItemIds, updates, force } = validation.data
  const results: any[] = []
  const errors: any[] = []

  for (const lineItemId of lineItemIds) {
    try {
      const updatedItem = await LineItemCrudService.updateLineItem(
        lineItemId,
        updates,
        organizationId,
        userId,
        { force }
      )
      results.push({ lineItemId, status: 'success', data: updatedItem })
    } catch (error: any) {
      errors.push({ 
        lineItemId, 
        status: 'error', 
        error: error.message || 'Unknown error' 
      })
    }
  }

  return NextResponse.json({
    message: `Bulk update completed. ${results.length} succeeded, ${errors.length} failed.`,
    results,
    errors
  })
}

async function handleBulkDelete(
  data: any,
  organizationId: string,
  userId: string
): Promise<NextResponse> {
  const validation = bulkDeleteSchema.safeParse(data)
  
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Validation error', details: validation.error.issues },
      { status: 400 }
    )
  }

  const { lineItemIds, force } = validation.data
  const results: any[] = []
  const errors: any[] = []

  for (const lineItemId of lineItemIds) {
    try {
      await LineItemCrudService.deleteLineItem(
        lineItemId,
        organizationId,
        userId,
        { force }
      )
      results.push({ lineItemId, status: 'success' })
    } catch (error: any) {
      errors.push({ 
        lineItemId, 
        status: 'error', 
        error: error.message || 'Unknown error' 
      })
    }
  }

  return NextResponse.json({
    message: `Bulk delete completed. ${results.length} succeeded, ${errors.length} failed.`,
    results,
    errors
  })
}

async function handleBulkProtectionCheck(
  data: any,
  organizationId: string
): Promise<NextResponse> {
  const validation = bulkProtectionCheckSchema.safeParse(data)
  
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Validation error', details: validation.error.issues },
      { status: 400 }
    )
  }

  const { lineItemIds } = validation.data
  const results: any[] = []
  const errors: any[] = []

  for (const lineItemId of lineItemIds) {
    try {
      const protection = await LineItemCrudService.checkPaymentProtection(
        lineItemId,
        organizationId
      )
      results.push({ lineItemId, status: 'success', data: protection })
    } catch (error: any) {
      errors.push({ 
        lineItemId, 
        status: 'error', 
        error: error.message || 'Unknown error' 
      })
    }
  }

  const summary = {
    total: lineItemIds.length,
    protected: results.filter(r => r.data?.isProtected).length,
    unprotected: results.filter(r => r.data && !r.data.isProtected).length,
    errors: errors.length
  }

  return NextResponse.json({
    message: 'Bulk protection check completed',
    summary,
    results,
    errors
  })
}