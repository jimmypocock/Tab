import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import { tabs } from '@/lib/db/schema'
import { validateApiKey, createApiResponse, createApiError, parseJsonBody } from '@/lib/api/middleware'
import { updateTabSchema } from '@/lib/api/validation'
import { eq, and } from 'drizzle-orm'
import { 
  parseFieldSelection, 
  applyFieldSelection,
  DefaultFields,
  validateFieldSelection 
} from '@/lib/api/field-selection'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Validate API key
  const { valid, context, error } = await validateApiKey(request)
  if (!valid) {
    return createApiError((error as Error)?.message || 'Unauthorized', 401)
  }

  // Parse field selection
  const { searchParams } = new URL(request.url)
  const requestedFields = parseFieldSelection(searchParams.get('fields'))
  const selectedFields = requestedFields || DefaultFields.tabWithItems
  
  // Validate field selection if provided
  if (requestedFields) {
    const validation = validateFieldSelection(requestedFields, DefaultFields.tabWithItems)
    if (!validation.valid) {
      return createApiError(
        `Invalid fields: ${validation.invalidFields?.join(', ')}`,
        400,
        'INVALID_FIELDS'
      )
    }
  }

  try {
    // Fetch tab with all related data
    const tab = await db.query.tabs.findFirst({
      where: (tabs, { eq, and }) => 
        and(
          eq(tabs.id, params.id),
          eq(tabs.merchantId, context!.merchantId)
        ),
      with: {
        lineItems: true,
        payments: {
          orderBy: (payments, { desc }) => [desc(payments.createdAt)],
        },
        invoices: {
          orderBy: (invoices, { desc }) => [desc(invoices.createdAt)],
        },
      },
    })

    if (!tab) {
      return createApiError('Tab not found', 404, 'NOT_FOUND')
    }

    // Calculate balance
    const balance = parseFloat(tab.totalAmount) - parseFloat(tab.paidAmount)
    const enrichedTab = {
      ...tab,
      balance: balance.toFixed(2),
    }

    // Apply field selection
    const projectedTab = applyFieldSelection(enrichedTab, selectedFields)

    return createApiResponse(projectedTab)
  } catch (error) {
    console.error('Error fetching tab:', error)
    return createApiError('Failed to fetch tab', 500, 'INTERNAL_ERROR')
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

  const validation = updateTabSchema.safeParse(body)
  if (!validation.success) {
    return createApiError('Invalid request data', 400, 'VALIDATION_ERROR', validation.error.errors)
  }

  const data = validation.data

  try {
    // Update tab
    const [updatedTab] = await db
      .update(tabs)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tabs.id, params.id),
          eq(tabs.merchantId, context!.merchantId)
        )
      )
      .returning()

    if (!updatedTab) {
      return createApiError('Tab not found', 404, 'NOT_FOUND')
    }

    // Fetch complete updated tab
    const completeTab = await db.query.tabs.findFirst({
      where: (tabs, { eq }) => eq(tabs.id, updatedTab.id),
      with: {
        lineItems: true,
        payments: {
          orderBy: (payments, { desc }) => [desc(payments.createdAt)],
        },
      },
    })

    return createApiResponse(completeTab)
  } catch (error) {
    console.error('Error updating tab:', error)
    return createApiError('Failed to update tab', 500, 'INTERNAL_ERROR')
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Validate API key
  const { valid, context, error } = await validateApiKey(request)
  if (!valid) {
    return createApiError((error as Error)?.message || 'Unauthorized', 401)
  }

  try {
    // Check if tab exists and belongs to merchant
    const tab = await db.query.tabs.findFirst({
      where: (tabs, { eq, and }) => 
        and(
          eq(tabs.id, params.id),
          eq(tabs.merchantId, context!.merchantId)
        ),
    })

    if (!tab) {
      return createApiError('Tab not found', 404, 'NOT_FOUND')
    }

    // Don't allow deletion of tabs with payments
    if (parseFloat(tab.paidAmount) > 0) {
      return createApiError('Cannot delete tab with payments', 400, 'HAS_PAYMENTS')
    }

    // Delete tab (line items will cascade)
    await db.delete(tabs).where(eq(tabs.id, params.id))

    return createApiResponse({ success: true }, 200)
  } catch (error) {
    console.error('Error deleting tab:', error)
    return createApiError('Failed to delete tab', 500, 'INTERNAL_ERROR')
  }
}