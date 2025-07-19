import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import { tabs, lineItems } from '@/lib/db/schema'
import { withApiAuth, parseJsonBody, ApiContext } from '@/lib/api/middleware'
import { createTabSchema, tabQuerySchema, validateInput } from '@/lib/api/validation'
import { 
  createSuccessResponse,
  ApiResponseBuilder 
} from '@/lib/api/response'
import { CacheConfigs } from '@/lib/api/cache'
import { 
  ValidationError, 
  DatabaseError
} from '@/lib/errors'
import { logger } from '@/lib/logger'
import { 
  TAX_RATE, 
  calculateTabBalance,
  getTabStatus,
  PAGINATION_MAX_LIMIT 
} from '@/lib/utils'
import { eq, and, gte, lte, like } from 'drizzle-orm'
import { countRows } from '@/lib/db/queries'
import { 
  parseFieldSelection, 
  applyFieldSelection,
  DefaultFields,
  validateFieldSelection 
} from '@/lib/api/field-selection'

export async function POST(request: NextRequest) {
  return withApiAuth(request, async (req: NextRequest, context: ApiContext) => {
    // Parse request body
    const body = await parseJsonBody(req)
    
    // Validate input
    const validation = validateInput(createTabSchema, body)
    if (!validation.success) {
      throw new ValidationError('Invalid request data', validation.error.issues)
    }

    const data = validation.data
    const taxRate = data.taxRate ?? TAX_RATE

    try {
      // Calculate totals
      let subtotal = 0
      const lineItemsData = data.lineItems.map(item => {
        const total = (item.quantity || 1) * (item.unitPrice || 0)
        subtotal += total
        return {
          ...item,
          total: total.toFixed(2),
          unitPrice: (item.unitPrice || 0).toFixed(2),
          metadata: item.metadata || null,
        }
      })

      // Calculate tax and total
      const taxAmount = subtotal * taxRate
      const totalAmount = subtotal + taxAmount

      // Create tab with line items in a transaction
      const result = await db.transaction(async (tx) => {
        // Create the tab
        const [newTab] = await tx.insert(tabs).values({
          merchantId: context.merchantId,
          customerEmail: data.customerEmail,
          customerName: data.customerName || null,
          externalReference: data.externalReference || null,
          currency: data.currency,
          subtotal: subtotal.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          metadata: data.metadata || null,
        }).returning()

        if (!newTab) {
          throw new DatabaseError('Failed to create tab')
        }

        // Create line items
        if (lineItemsData.length > 0) {
          await tx.insert(lineItems).values(
            lineItemsData.map(item => ({
              tabId: newTab.id,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
              metadata: item.metadata,
            }))
          )
        }

        // Fetch the complete tab with line items
        const completeTab = await tx.query.tabs.findFirst({
          where: (tabs, { eq }) => eq(tabs.id, newTab.id),
          with: {
            lineItems: {
              orderBy: (lineItems, { asc }) => [asc(lineItems.createdAt)],
            },
          },
        })

        return completeTab
      })

      logger.info('Tab created', {
        tabId: result?.id,
        merchantId: context.merchantId,
        requestId: context.requestId,
        totalAmount: totalAmount.toFixed(2),
      })

      return new ApiResponseBuilder()
        .setData({
          tab: result,
          paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL}/pay/${result?.id}`,
        })
        .setStatusCode(201)
        .build()
        
    } catch (error) {
      logger.error('Failed to create tab', error as Error, {
        merchantId: context.merchantId,
        requestId: context.requestId,
      })
      throw new DatabaseError('Failed to create tab', error)
    }
  })
}

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (req: NextRequest, context: ApiContext) => {
    // Parse query parameters
    const { searchParams } = new URL(req.url)
    const queryParams = Object.fromEntries(searchParams.entries())
    
    // Parse field selection
    const requestedFields = parseFieldSelection(searchParams.get('fields'))
    const selectedFields = requestedFields || DefaultFields.tab
    
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
    
    // Validate query parameters
    const validation = validateInput(tabQuerySchema, queryParams)
    if (!validation.success) {
      throw new ValidationError('Invalid query parameters', validation.error.issues)
    }

    const query = validation.data
    const limit = Math.min(query.limit || 10, PAGINATION_MAX_LIMIT)
    const offset = ((query.page || 1) - 1) * limit

    try {
      // Build where conditions
      const conditions = [eq(tabs.merchantId, context.merchantId)]
      
      if (query.status) {
        conditions.push(eq(tabs.status, query.status))
      }
      
      if (query.customerEmail) {
        conditions.push(eq(tabs.customerEmail, query.customerEmail))
      }
      
      if (query.externalReference) {
        conditions.push(like(tabs.externalReference, `%${query.externalReference}%`))
      }
      
      if (query.createdAfter) {
        conditions.push(gte(tabs.createdAt, new Date(query.createdAfter)))
      }
      
      if (query.createdBefore) {
        conditions.push(lte(tabs.createdAt, new Date(query.createdBefore)))
      }

      // Execute queries in parallel
      const [results, totalCount] = await Promise.all([
        db.query.tabs.findMany({
          where: conditions.length > 0 ? and(...conditions) : undefined,
          with: {
            lineItems: {
              orderBy: (lineItems, { asc }) => [asc(lineItems.createdAt)],
            },
            payments: {
              where: (payments, { eq }) => eq(payments.status, 'succeeded'),
              orderBy: (payments, { desc }) => [desc(payments.createdAt)],
            },
          },
          limit,
          offset,
          orderBy: query.sortBy === 'amount' 
            ? query.sortOrder === 'asc' 
              ? (tabs, { asc }) => [asc(tabs.totalAmount)]
              : (tabs, { desc }) => [desc(tabs.totalAmount)]
            : query.sortOrder === 'asc'
              ? (tabs, { asc }) => [asc(tabs.createdAt)]
              : (tabs, { desc }) => [desc(tabs.createdAt)],
        }),
        countRows(tabs, conditions.length > 0 ? and(...conditions) : undefined),
      ])

      // Add computed fields
      const enrichedResults = results.map(tab => ({
        ...tab,
        balance: calculateTabBalance(tab.totalAmount, tab.paidAmount),
        computedStatus: getTabStatus(tab.totalAmount, tab.paidAmount, tab.status),
      }))

      // Apply field selection
      const projectedResults = applyFieldSelection(enrichedResults, selectedFields)

      logger.debug('Tabs fetched', {
        count: results.length,
        merchantId: context.merchantId,
        requestId: context.requestId,
        fieldsRequested: requestedFields ? Array.from(requestedFields) : 'default',
      })

      return new ApiResponseBuilder()
        .setData(projectedResults)
        .setPagination(query.page || 1, limit, totalCount)
        .setCache(CacheConfigs.shortPrivate)
        .build()
        
    } catch (error) {
      logger.error('Failed to fetch tabs', error as Error, {
        merchantId: context.merchantId,
        requestId: context.requestId,
      })
      throw new DatabaseError('Failed to fetch tabs', error)
    }
  })
}

// Handle OPTIONS for CORS
export async function OPTIONS(_request: NextRequest) {
  return createSuccessResponse({}, undefined, 204)
}