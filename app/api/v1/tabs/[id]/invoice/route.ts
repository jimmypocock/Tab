import { NextRequest, NextResponse } from 'next/server'
import { withApiAuth } from '@/lib/api/middleware'
import { InvoiceService } from '@/lib/services/invoice.service'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ id: string }>
}

// Generate invoice for a tab
export const POST = withApiAuth(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }>; merchantId: string }
): Promise<NextResponse> => {
  try {
    const { id: tabId } = await context.params
    const { merchantId } = context

    // Generate invoice
    const invoice = await InvoiceService.generateInvoice(tabId, merchantId)

    // Optionally send immediately based on query param
    const url = new URL(request.url)
    const sendImmediately = url.searchParams.get('send') === 'true'

    if (sendImmediately) {
      // Get recipient emails from request body
      const body = await request.json().catch(() => ({}))
      const { recipientEmail, ccEmails } = body
      
      await InvoiceService.sendInvoice(invoice.id, merchantId, recipientEmail, ccEmails)
      
      logger.info('Invoice generated and sent', { 
        tabId, 
        invoiceId: invoice.id,
        merchantId,
        recipientEmail: recipientEmail || 'default',
        ccCount: ccEmails?.length || 0
      })

      return NextResponse.json({
        success: true,
        invoice,
        sent: true,
        message: 'Invoice generated and sent successfully'
      })
    }

    logger.info('Invoice generated', { 
      tabId, 
      invoiceId: invoice.id,
      merchantId 
    })

    return NextResponse.json({
      success: true,
      invoice,
      sent: false,
      message: 'Invoice generated successfully'
    })
  } catch (error: any) {
    logger.error('Failed to generate invoice', error)
    
    if (error.message === 'Tab not found') {
      return NextResponse.json(
        { error: 'Tab not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to generate invoice' },
      { status: 500 }
    )
  }
})