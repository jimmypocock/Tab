import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { InvoiceService } from '@/lib/services/invoice.service'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{ id: string }>
}

// Generate and optionally send invoice for a tab (Dashboard endpoint - uses session auth)
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    
    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: tabId } = await context.params
    const merchantId = user.id

    // Generate invoice
    const invoice = await InvoiceService.generateInvoice(tabId, merchantId)

    // Check if we should send immediately
    const url = new URL(request.url)
    const sendImmediately = url.searchParams.get('send') === 'true'

    if (sendImmediately) {
      // Get recipient emails from request body
      const body = await request.json().catch(() => ({}))
      const { recipientEmail, ccEmails } = body
      
      await InvoiceService.sendInvoice(invoice.id, merchantId, recipientEmail, ccEmails)
      
      logger.info('Invoice generated and sent from dashboard', { 
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

    logger.info('Invoice generated from dashboard', { 
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
    logger.error('Failed to generate invoice from dashboard', error)
    
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
}