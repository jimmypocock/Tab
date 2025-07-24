import { NextRequest, NextResponse } from 'next/server'
import { withOrganizationAuth, OrganizationContext } from '@/lib/api/organization-middleware'
import { db } from '@/lib/db'
import { invoices } from '@/lib/db/schema'
import { InvoiceService } from '@/lib/services/invoice.service'
import { eq, desc } from 'drizzle-orm'
import { z } from 'zod'
import { ApiResponseBuilder } from '@/lib/api/response'
import { logger } from '@/lib/logger'

// Create invoice validation schema
const createInvoiceSchema = z.object({
  tabId: z.string().uuid().optional(),
  billingGroupId: z.string().uuid().optional(), // Support billing group invoices
  lineItemIds: z.array(z.string().uuid()).optional(),
  customerEmail: z.string().email().optional(),
  customerName: z.string().optional(),
  lineItems: z.array(z.object({
    description: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    category: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  })).optional(),
  dueDate: z.string().transform(val => new Date(val)),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
  billingAddress: z.record(z.any()).optional(),
  shippingAddress: z.record(z.any()).optional(),
})

export async function GET(request: NextRequest) {
  return withOrganizationAuth(request, async (_req: NextRequest, context: OrganizationContext) => {
    try {
      // Get query parameters
      const searchParams = request.nextUrl.searchParams
      const status = searchParams.get('status')
      const limit = parseInt(searchParams.get('limit') || '20')
      const offset = parseInt(searchParams.get('offset') || '0')

      // Build query
      let query = db.select().from(invoices)
        .where(eq(invoices.organizationId, context.organizationId))
        .orderBy(desc(invoices.createdAt))
        .limit(limit)
        .offset(offset)

      const invoiceList = await query

      return ApiResponseBuilder.success({
        invoices: invoiceList,
        limit,
        offset,
      })
    } catch (error) {
      logger.error('Error fetching invoices', { error, organizationId: context.organizationId })
      return ApiResponseBuilder.error('Failed to fetch invoices', 500)
    }
  })
}

export async function POST(request: NextRequest) {
  return withOrganizationAuth(request, async (req: NextRequest, context: OrganizationContext) => {
    try {
      const body = await req.json()
      const validatedData = createInvoiceSchema.parse(body)

      let invoice

      if (validatedData.tabId) {
        // Create invoice from tab (with optional billing group filtering)
        invoice = await InvoiceService.createInvoiceFromTab({
          tabId: validatedData.tabId,
          organizationId: context.organizationId,
          lineItemIds: validatedData.lineItemIds,
          billingGroupId: validatedData.billingGroupId, // Pass billing group filter
          dueDate: validatedData.dueDate,
          paymentTerms: validatedData.paymentTerms,
          notes: validatedData.notes,
          billingAddress: validatedData.billingAddress,
          shippingAddress: validatedData.shippingAddress,
        })
      } else if (validatedData.customerEmail && validatedData.lineItems) {
        // Create manual invoice
        invoice = await InvoiceService.createManualInvoice({
          organizationId: context.organizationId,
          customerEmail: validatedData.customerEmail,
          customerName: validatedData.customerName,
          lineItems: validatedData.lineItems,
          dueDate: validatedData.dueDate,
          paymentTerms: validatedData.paymentTerms,
          notes: validatedData.notes,
          billingAddress: validatedData.billingAddress,
          shippingAddress: validatedData.shippingAddress,
        })
      } else {
        return ApiResponseBuilder.error('Either tabId or customerEmail with lineItems required', 400)
      }

      return ApiResponseBuilder.success(invoice, 201)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return ApiResponseBuilder.validationError(error.errors)
      }

      logger.error('Error creating invoice', { error, organizationId: context.organizationId })
      return ApiResponseBuilder.error('Failed to create invoice', 500)
    }
  })
}