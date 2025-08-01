/**
 * Invoice Routes - Refactored with DI Pattern
 */

import { NextRequest } from 'next/server'
import { withMerchantDI } from '@/lib/api/di-middleware'
import { validateInput } from '@/lib/api/validation'
import { ApiResponseBuilder } from '@/lib/api/response'
import { CacheConfigs } from '@/lib/api/cache'
import { ValidationError } from '@/lib/errors'
import { parseJsonBody } from '@/lib/api/middleware'
import { z } from 'zod'

const createInvoiceSchema = z.object({
  tabId: z.string().uuid(),
  billingGroupId: z.string().uuid().optional(),
  dueDate: z.string().transform(val => new Date(val)).optional(),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional(),
})

/**
 * GET /api/v1/invoices - List invoices
 */
export const GET = withMerchantDI(async (context) => {
  // Parse query parameters
  const { searchParams } = new URL(context.request.url)
  const status = searchParams.get('status')
  const tabId = searchParams.get('tab_id')
  const billingGroupId = searchParams.get('billing_group_id')
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

  // Build filters
  const filters: any = {}
  if (status) filters.status = status as any
  if (tabId) filters.tabId = tabId
  if (billingGroupId) filters.billingGroupId = billingGroupId

  // Get invoices using service
  const result = await context.invoiceService.listInvoices(context.organizationId, filters, {
    page,
    pageSize,
  })

  return new ApiResponseBuilder()
    .setData(result.data)
    .setPagination(
      result.pagination.page,
      result.pagination.pageSize,
      result.pagination.totalItems
    )
    .setCache(CacheConfigs.shortPrivate)
    .build()
})

/**
 * POST /api/v1/invoices - Create invoice
 */
export const POST = withMerchantDI(async (context) => {
  // Parse request body
  const body = await parseJsonBody(context.request)
  if (!body) {
    throw new ValidationError('Request body is required')
  }

  // Validate input
  const validation = validateInput(body, createInvoiceSchema)
  if (!validation.success) {
    return new ApiResponseBuilder()
      .setStatus(400)
      .setError('Invalid request data', validation.errors)
      .build()
  }

  // Create invoice using service
  const invoice = await context.invoiceService.createInvoice(
    context.organizationId,
    validation.data
  )

  return new ApiResponseBuilder()
    .setStatus(201)
    .setData(invoice)
    .build()
})

/**
 * OPTIONS - Handle CORS
 */
export async function OPTIONS(_request: NextRequest) {
  return new ApiResponseBuilder()
    .setStatus(204)
    .build()
}