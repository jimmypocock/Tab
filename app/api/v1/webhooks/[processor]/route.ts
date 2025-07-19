import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { payments, tabs, merchantProcessors } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { MerchantProcessorService } from '@/lib/services/merchant-processor.service'
import { ProcessorType, WebhookEventType } from '@/lib/payment-processors/types'
import { logger } from '@/lib/logger'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ processor: string }> }
) {
  const params = await context.params
  const processorType = params.processor as ProcessorType
  
  try {
    // Get raw body and signature
    const body = await request.text()
    const signature = request.headers.get('stripe-signature') || 
                     request.headers.get('x-webhook-signature') || 
                     request.headers.get('x-square-signature') || ''
    
    // Parse the webhook to find merchant context
    // Different processors put merchant/payment info in different places
    let merchantId: string | null = null
    
    // Quick parse to extract metadata (processor-specific)
    if (processorType === ProcessorType.STRIPE) {
      try {
        const jsonBody = JSON.parse(body)
        merchantId = jsonBody.data?.object?.metadata?.merchant_id
      } catch (e) {
        // Will handle below
      }
    }
    
    if (!merchantId) {
      logger.error('No merchant ID found in webhook payload', new Error('Missing merchant ID'), { processorType })
      return NextResponse.json(
        { error: 'No merchant context found' },
        { status: 400 }
      )
    }
    
    // Get the merchant's processor configuration
    const processorConfig = await db.query.merchantProcessors.findFirst({
      where: and(
        eq(merchantProcessors.merchantId, merchantId),
        eq(merchantProcessors.processorType, processorType),
        eq(merchantProcessors.isActive, true)
      ),
    })
    
    if (!processorConfig) {
      logger.error('No processor configuration found', new Error('Missing processor config'), { merchantId, processorType })
      return NextResponse.json(
        { error: 'Processor not configured' },
        { status: 404 }
      )
    }
    
    // Create processor instance and validate webhook
    const processor = await MerchantProcessorService.createProcessorInstance(
      merchantId,
      processorType,
      processorConfig.isTestMode
    )
    
    // Construct and validate the webhook event
    const event = await processor.constructWebhookEvent(body, signature)
    
    logger.info('Webhook received', {
      processorType,
      eventType: event.type,
      eventId: event.id,
      merchantId,
    })
    
    // Handle the webhook event
    await handleWebhookEvent(event, processorConfig.id, merchantId)
    
    return NextResponse.json({ received: true })
  } catch (error: any) {
    logger.error('Webhook processing failed', error, {
      processorType,
      error: error.message,
    })
    
    // Return appropriate status based on error
    if (error.code === 'webhook_validation_failed') {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function handleWebhookEvent(
  event: any,
  processorId: string,
  _merchantId: string
) {
  switch (event.type) {
    case WebhookEventType.CHECKOUT_COMPLETED: {
      const session = event.data
      const tabId = session.metadata?.tab_id
      const amount = session.amount
      
      if (!tabId) {
        logger.error('No tabId in checkout session metadata')
        return
      }
      
      // Create payment record
      const [payment] = await db
        .insert(payments)
        .values({
          tabId,
          processorId,
          amount: amount.toString(),
          currency: session.currency || 'USD',
          status: 'succeeded',
          processor: event.processorEvent.type,
          processorPaymentId: session.processorSessionId,
          metadata: {
            webhook_event_id: event.id,
            checkout_session_id: session.id,
          },
        })
        .returning()
      
      // Update tab paid amount
      if (payment) {
        await updateTabPayment(tabId, parseFloat(payment.amount))
      }
      break
    }
    
    case WebhookEventType.PAYMENT_SUCCEEDED: {
      const paymentIntent = event.data
      
      // Update payment record
      const [payment] = await db
        .update(payments)
        .set({
          status: 'succeeded',
          metadata: {
            webhook_event_id: event.id,
          },
        })
        .where(eq(payments.processorPaymentId, paymentIntent.processorPaymentId))
        .returning()

      if (payment) {
        await updateTabPayment(payment.tabId, parseFloat(payment.amount))
      }
      break
    }

    case WebhookEventType.PAYMENT_FAILED: {
      const paymentIntent = event.data
      
      // Update payment record
      await db
        .update(payments)
        .set({
          status: 'failed',
          failureReason: paymentIntent.failureReason,
          metadata: {
            webhook_event_id: event.id,
          },
        })
        .where(eq(payments.processorPaymentId, paymentIntent.processorPaymentId))
      break
    }

    case WebhookEventType.REFUND_CREATED: {
      const refund = event.data
      
      // Update payment record
      const [payment] = await db
        .update(payments)
        .set({
          status: refund.full ? 'refunded' : 'partially_refunded',
          metadata: {
            webhook_event_id: event.id,
            refund_amount: refund.amount,
          },
        })
        .where(eq(payments.processorPaymentId, refund.paymentId))
        .returning()

      if (payment && refund.full) {
        // Subtract from tab paid amount
        await updateTabPayment(payment.tabId, -parseFloat(payment.amount))
      }
      break
    }

    default:
      logger.info(`Unhandled webhook event type: ${event.type}`)
  }
}

async function updateTabPayment(tabId: string, amountChange: number) {
  const tab = await db.query.tabs.findFirst({
    where: eq(tabs.id, tabId),
  })
  
  if (!tab) {
    logger.error('Tab not found for payment update', new Error('Tab not found'), { tabId })
    return
  }
  
  const newPaidAmount = Math.max(0, parseFloat(tab.paidAmount) + amountChange)
  const totalAmount = parseFloat(tab.totalAmount)
  const newStatus = newPaidAmount >= totalAmount ? 'paid' : 
                   newPaidAmount > 0 ? 'partial' : 'open'
  
  await db
    .update(tabs)
    .set({
      paidAmount: newPaidAmount.toFixed(2),
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(tabs.id, tab.id))
    
  logger.info('Tab payment updated', {
    tabId,
    oldPaidAmount: tab.paidAmount,
    newPaidAmount,
    newStatus,
  })
}