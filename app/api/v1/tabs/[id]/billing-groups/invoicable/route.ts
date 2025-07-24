import { NextRequest } from 'next/server'
import { withOrganizationAuth, OrganizationContext } from '@/lib/api/organization-middleware'
import { InvoiceService } from '@/lib/services/invoice.service'
import { 
  ApiResponseBuilder,
  createSuccessResponse 
} from '@/lib/api/response'
import { 
  NotFoundError,
  DatabaseError
} from '@/lib/errors'
import { logger } from '@/lib/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withOrganizationAuth(request, async (_req: NextRequest, context: OrganizationContext) => {
    const tabId = params.id
    
    try {
      // Get all billing groups that can be invoiced for this tab
      const invoicableBillingGroups = await InvoiceService.getInvoicableBillingGroups(
        tabId,
        context.organizationId
      )

      // Get summary information
      const summary = {
        totalGroups: invoicableBillingGroups.length,
        totalInvoicableAmount: invoicableBillingGroups.reduce((sum, group) => 
          sum + group.totalAmount, 0
        ),
        totalLineItems: invoicableBillingGroups.reduce((sum, group) => 
          sum + group.lineItemsCount, 0
        ),
        groupsByType: invoicableBillingGroups.reduce((acc, group) => {
          acc[group.groupType] = (acc[group.groupType] || 0) + 1
          return acc
        }, {} as Record<string, number>),
      }

      return new ApiResponseBuilder()
        .setData({
          billingGroups: invoicableBillingGroups,
          summary,
        })
        .build()
        
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error
      }
      
      logger.error('Failed to get invoicable billing groups', error as Error, {
        tabId,
        organizationId: context.organizationId,
      })
      
      throw new DatabaseError('Failed to get invoicable billing groups', error)
    }
  }, {
    requiredScope: 'merchant'
  })
}

// Handle OPTIONS for CORS
export async function OPTIONS(_request: NextRequest) {
  return createSuccessResponse({}, undefined, 204)
}