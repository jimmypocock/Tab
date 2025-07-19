import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import { tabs } from '@/lib/db/schema'
import { withApiAuth, parseJsonBody, ApiContext } from '@/lib/api/middleware'
import { updateTabSchema, validateInput } from '@/lib/api/validation'
import { eq, and } from 'drizzle-orm'
import { 
  parseFieldSelection, 
  applyFieldSelection,
  DefaultFields,
  validateFieldSelection 
} from '@/lib/api/field-selection'
import { 
  createSuccessResponse,
  ApiResponseBuilder 
} from '@/lib/api/response'
import { 
  NotFoundError,
  ValidationError,
  ConflictError,
  DatabaseError
} from '@/lib/errors'
import { logger } from '@/lib/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Await params in Next.js 15
  const { id } = await params
  
  return withApiAuth(request, async (_req: NextRequest, context: ApiContext) => {
    // Parse field selection
    const { searchParams } = new URL(_req.url)
    const requestedFields = parseFieldSelection(searchParams.get('fields'))
    const selectedFields = requestedFields || DefaultFields.tabWithItems
    
    // Validate field selection if provided
    if (requestedFields) {
      const validation = validateFieldSelection(requestedFields, DefaultFields.tabWithItems)
      if (!validation.valid) {
        throw new ValidationError(
          `Invalid fields: ${validation.invalidFields?.join(', ')}`,
          [{ message: 'Invalid field selection', path: ['fields'] }]
        )
      }
    }

    try {
      // Fetch tab with all related data
      const tab = await db.query.tabs.findFirst({
        where: (tabs, { eq, and }) => 
          and(
            eq(tabs.id, id),
            eq(tabs.merchantId, context.merchantId)
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
        throw new NotFoundError('Tab')
      }

      // Calculate balance
      const balance = parseFloat(tab.totalAmount) - parseFloat(tab.paidAmount)
      const enrichedTab = {
        ...tab,
        balance: balance.toFixed(2),
      }

      // Apply field selection
      const projectedTab = applyFieldSelection(enrichedTab, selectedFields)

      logger.debug('Tab fetched', {
        tabId: id,
        merchantId: context.merchantId,
        requestId: context.requestId,
        fieldsRequested: requestedFields ? Array.from(requestedFields) : 'default',
      })

      return new ApiResponseBuilder()
        .setData(projectedTab)
        .build()
        
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error
      }
      logger.error('Failed to fetch tab', error as Error, {
        tabId: id,
        merchantId: context.merchantId,
        requestId: context.requestId,
      })
      throw new DatabaseError('Failed to fetch tab', error)
    }
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Await params in Next.js 15
  const { id } = await params
  
  return withApiAuth(request, async (_req: NextRequest, context: ApiContext) => {
    // Parse and validate request body
    const body = await parseJsonBody(_req)
    
    const validation = validateInput(updateTabSchema, body)
    if (!validation.success) {
      throw new ValidationError('Invalid request data', validation.error.issues)
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
            eq(tabs.id, id),
            eq(tabs.merchantId, context.merchantId)
          )
        )
        .returning()

      if (!updatedTab) {
        throw new NotFoundError('Tab')
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

      logger.info('Tab updated', {
        tabId: id,
        merchantId: context.merchantId,
        requestId: context.requestId,
        updates: Object.keys(data),
      })

      return new ApiResponseBuilder()
        .setData(completeTab)
        .build()
        
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error
      }
      logger.error('Failed to update tab', error as Error, {
        tabId: id,
        merchantId: context.merchantId,
        requestId: context.requestId,
      })
      throw new DatabaseError('Failed to update tab', error)
    }
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Await params in Next.js 15
  const { id } = await params
  
  return withApiAuth(request, async (_req: NextRequest, context: ApiContext) => {
    try {
      // Check if tab exists and belongs to merchant
      const tab = await db.query.tabs.findFirst({
        where: (tabs, { eq, and }) => 
          and(
            eq(tabs.id, id),
            eq(tabs.merchantId, context.merchantId)
          ),
      })

      if (!tab) {
        throw new NotFoundError('Tab')
      }

      // Don't allow deletion of tabs with payments
      if (parseFloat(tab.paidAmount) > 0) {
        throw new ConflictError('Cannot delete tab with payments')
      }

      // Delete tab (line items will cascade)
      await db.delete(tabs).where(eq(tabs.id, id))

      logger.info('Tab deleted', {
        tabId: id,
        merchantId: context.merchantId,
        requestId: context.requestId,
      })

      return createSuccessResponse({ success: true })
      
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ConflictError) {
        throw error
      }
      logger.error('Failed to delete tab', error as Error, {
        tabId: id,
        merchantId: context.merchantId,
        requestId: context.requestId,
      })
      throw new DatabaseError('Failed to delete tab', error)
    }
  })
}

// Handle OPTIONS for CORS
export async function OPTIONS(_request: NextRequest) {
  return createSuccessResponse({}, undefined, 204)
}