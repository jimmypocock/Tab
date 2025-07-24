import { NextRequest } from 'next/server'
import { withOrganizationAuth, OrganizationContext } from '@/lib/api/organization-middleware'
import { parseJsonBody } from '@/lib/api/middleware'
import { createBillingGroupInvoiceSchema, validateInput } from '@/lib/api/validation'
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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withOrganizationAuth(request, async (req: NextRequest, context: OrganizationContext) => {
    const billingGroupId = params.id
    
    try {
      // Parse and validate request body
      const body = await parseJsonBody(req)
      
      const validation = validateInput(createBillingGroupInvoiceSchema, {
        ...body,
        billingGroupId, // Inject billing group ID from URL
      })
      
      if (!validation.success) {
        throw new ValidationError('Invalid request data', validation.error.issues)
      }

      const data = validation.data

      // Create invoice for the billing group
      const invoice = await InvoiceService.createBillingGroupInvoice({
        billingGroupId,
        organizationId: context.organizationId,
        dueDate: new Date(data.dueDate),
        paymentTerms: data.paymentTerms,
        notes: data.notes,
        includeUnassignedItems: data.includeUnassignedItems,
        billingAddress: data.billingAddress,
        shippingAddress: data.shippingAddress,
      })

      // Send invoice immediately if requested
      if (data.sendImmediately) {
        try {
          await InvoiceService.sendInvoice(invoice.id, {
            message: data.notes,
          })
          
          logger.info('Billing group invoice sent immediately', {
            invoiceId: invoice.id,
            billingGroupId,
            organizationId: context.organizationId,
          })
        } catch (sendError) {
          logger.warn('Failed to send invoice immediately', {
            invoiceId: invoice.id,
            billingGroupId,
            error: sendError,
          })
          // Don't fail the invoice creation if sending fails
        }
      }

      return new ApiResponseBuilder()
        .setData({
          invoice,
          message: data.sendImmediately 
            ? 'Billing group invoice created and sent successfully'
            : 'Billing group invoice created successfully'
        })
        .setStatusCode(201)
        .build()
        
    } catch (error) {
      if (error instanceof NotFoundError || 
          error instanceof ValidationError) {
        throw error
      }
      
      logger.error('Failed to create billing group invoice', error as Error, {
        billingGroupId,
        organizationId: context.organizationId,
      })
      
      throw new DatabaseError('Failed to create billing group invoice', error)
    }
  }, {
    requiredScope: 'merchant'
  })
}

// Get invoice information for a billing group
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withOrganizationAuth(request, async (_req: NextRequest, context: OrganizationContext) => {
    const billingGroupId = params.id
    
    try {
      // Get invoicable billing groups for the tab this group belongs to
      const billingGroups = await InvoiceService.getInvoicableBillingGroups(
        billingGroupId, // This needs to be updated to get tab ID first
        context.organizationId
      )
      
      const billingGroup = billingGroups.find(bg => bg.id === billingGroupId)
      
      if (!billingGroup) {
        throw new NotFoundError('Billing group not found or cannot be invoiced')
      }

      return new ApiResponseBuilder()
        .setData({
          billingGroup,
          canInvoice: billingGroup.canInvoice,
          lineItemsCount: billingGroup.lineItemsCount,
          totalAmount: billingGroup.totalAmount,
        })
        .build()
        
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error
      }
      
      logger.error('Failed to get billing group invoice info', error as Error, {
        billingGroupId,
        organizationId: context.organizationId,
      })
      
      throw new DatabaseError('Failed to get billing group invoice info', error)
    }
  }, {
    requiredScope: 'merchant'
  })
}

// Handle OPTIONS for CORS
export async function OPTIONS(_request: NextRequest) {
  return createSuccessResponse({}, undefined, 204)
}