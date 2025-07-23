import { NextRequest, NextResponse } from 'next/server'
import { withOrganizationAuth, OrganizationContext } from '@/lib/api/organization-middleware'
import { InvoiceService } from '@/lib/services/invoice.service'
import { ApiResponseBuilder } from '@/lib/api/response'
import { logger } from '@/lib/logger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withOrganizationAuth(request, async (_req: NextRequest, context: OrganizationContext) => {
    try {
      const { id } = await params

      // Send the invoice
      const result = await InvoiceService.sendInvoice(id, context.organizationId)

      logger.info('Invoice sent successfully', { 
        invoiceId: id, 
        organizationId: context.organizationId,
        emailId: result.emailId 
      })

      return ApiResponseBuilder.success({
        message: 'Invoice sent successfully',
        emailId: result.emailId
      })
    } catch (error: any) {
      logger.error('Failed to send invoice', error)
      
      if (error.message === 'Invoice not found') {
        return ApiResponseBuilder.error('Invoice not found', 404)
      }
      
      if (error.message === 'Unauthorized') {
        return ApiResponseBuilder.error('Unauthorized', 403)
      }

      return ApiResponseBuilder.error('Failed to send invoice', 500)
    }
  })
}