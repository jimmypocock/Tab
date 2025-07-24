import { NextRequest } from 'next/server'
import { withOrganizationAuth, OrganizationContext } from '@/lib/api/organization-middleware'
import { parseJsonBody } from '@/lib/api/middleware'
import { createInvoiceSchema, validateInput } from '@/lib/api/validation'
import { InvoiceService } from '@/lib/services/invoice.service'
import { 
  ApiResponseBuilder,
  createSuccessResponse 
} from '@/lib/api/response'
import { 
  NotFoundError,
  ValidationError,
  DatabaseError
} from '@/lib/errors'
import { logger } from '@/lib/logger'

// Create invoice for a tab (with optional billing group filtering)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withOrganizationAuth(request, async (req: NextRequest, context: OrganizationContext) => {
    const tabId = params.id
    
    try {
      // Parse and validate request body
      const body = await parseJsonBody(req)
      
      const validation = validateInput(createInvoiceSchema, {
        ...body,
        tabId, // Inject tab ID from URL
      })
      
      if (!validation.success) {
        throw new ValidationError('Invalid request data', validation.error.issues)
      }

      const data = validation.data

      // Create invoice from tab
      const invoice = await InvoiceService.createInvoiceFromTab({
        tabId,
        organizationId: context.organizationId,
        lineItemIds: data.lineItemIds,
        billingGroupId: data.billingGroupId, // Support billing group filtering
        dueDate: new Date(data.dueDate),
        paymentTerms: data.paymentTerms,
        notes: data.notes,
        billingAddress: data.billingAddress,
        shippingAddress: data.shippingAddress,
      })

      // Send invoice immediately if requested
      if (data.sendImmediately) {
        try {
          await InvoiceService.sendInvoice(invoice.id, {
            message: data.notes,
          })
          
          logger.info('Tab invoice sent immediately', {
            invoiceId: invoice.id,
            tabId,
            billingGroupId: data.billingGroupId,
            organizationId: context.organizationId,
          })
        } catch (sendError) {
          logger.warn('Failed to send invoice immediately', {
            invoiceId: invoice.id,
            tabId,
            error: sendError,
          })
          // Don't fail the invoice creation if sending fails
        }
      }

      return new ApiResponseBuilder()
        .setData({
          invoice,
          message: data.sendImmediately 
            ? 'Invoice created and sent successfully'
            : 'Invoice created successfully'
        })
        .setStatusCode(201)
        .build()
        
    } catch (error) {
      if (error instanceof NotFoundError || 
          error instanceof ValidationError) {
        throw error
      }
      
      logger.error('Failed to create tab invoice', error as Error, {
        tabId,
        organizationId: context.organizationId,
      })
      
      throw new DatabaseError('Failed to create tab invoice', error)
    }
  }, {
    requiredScope: 'merchant'
  })
}

// Handle OPTIONS for CORS
export async function OPTIONS(_request: NextRequest) {
  return createSuccessResponse({}, undefined, 204)
}