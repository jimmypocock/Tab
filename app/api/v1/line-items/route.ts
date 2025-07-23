import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import { lineItems, tabs } from '@/lib/db/schema'
import { validateApiKey, createApiResponse, createApiError, parseJsonBody } from '@/lib/api/middleware'
import { createLineItemSchema } from '@/lib/api/validation'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  // Validate API key
  const { valid, context, error } = await validateApiKey(request)
  if (!valid) {
    return createApiError((error as Error)?.message || 'Unauthorized', 401)
  }

  // Parse and validate request body
  const body = await parseJsonBody(request)
  if (!body) {
    return createApiError('Invalid JSON body', 400)
  }

  const validation = createLineItemSchema.safeParse(body)
  if (!validation.success) {
    return createApiError('Invalid request data', 400, 'VALIDATION_ERROR', validation.error.issues)
  }

  const data = validation.data

  try {
    // Verify tab belongs to merchant
    const tab = await db.query.tabs.findFirst({
      where: (tabs, { eq, and }) => 
        and(
          eq(tabs.id, data.tabId),
          eq(tabs.merchantId, context!.merchantId)
        ),
    })

    if (!tab) {
      return createApiError('Tab not found', 404, 'NOT_FOUND')
    }

    // Calculate total
    const total = data.quantity * data.unitPrice

    // Create line item
    const [lineItem] = await db.insert(lineItems).values({
      tabId: data.tabId,
      description: data.description,
      quantity: data.quantity,
      unitPrice: data.unitPrice.toFixed(2),
      total: total.toFixed(2),
      metadata: data.metadata,
    }).returning()

    // Update tab totals
    const allLineItems = await db.query.lineItems.findMany({
      where: (lineItems, { eq }) => eq(lineItems.tabId, data.tabId),
    })

    const subtotal = allLineItems.reduce((sum, item) => 
      sum + parseFloat(item.total), 0
    )
    const taxAmount = subtotal * 0.08 // Simple 8% tax for MVP
    const totalAmount = subtotal + taxAmount

    await db
      .update(tabs)
      .set({
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(tabs.id, data.tabId))

    return createApiResponse(lineItem, 201)
  } catch (error) {
    logger.error('Error creating line item', { error, tabId: data.tabId, merchantId: context!.merchantId })
    return createApiError('Failed to create line item', 500, 'INTERNAL_ERROR')
  }
}