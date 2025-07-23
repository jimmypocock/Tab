import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { db } from '@/lib/db/client'
import { payments, tabs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err: any) {
    logger.error('Webhook signature verification failed', err, { 
      error: err.message 
    })
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }
  
  logger.info('Stripe webhook received', {
    eventType: event.type,
    eventId: event.id
  })

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        logger.info('Processing checkout.session.completed', {
          sessionId: session.id,
          paymentIntent: session.payment_intent,
          metadata: session.metadata,
          amountTotal: session.amount_total,
        })
        
        // Get tab info from metadata
        const tabId = session.metadata?.tabId
        const amount = session.metadata?.amount || (session.amount_total ? session.amount_total / 100 : 0)
        
        if (!tabId) {
          logger.error('No tabId in checkout session metadata', undefined, {
            sessionId: session.id
          })
          return NextResponse.json({ error: 'Missing tabId' }, { status: 400 })
        }
        
        // For checkout sessions, payment_intent might be an object or string
        const paymentIntentId = typeof session.payment_intent === 'string' 
          ? session.payment_intent 
          : session.payment_intent?.id || session.id
        
        logger.info('Creating payment record', {
          tabId,
          amount,
          paymentIntentId,
        })
        
        // Create payment record
        const [payment] = await db
          .insert(payments)
          .values({
            tabId,
            amount: amount.toString(),
            currency: session.currency?.toUpperCase() || 'USD',
            status: 'succeeded',
            processor: 'stripe',
            processorPaymentId: paymentIntentId,
            metadata: {
              stripe_event_id: event.id,
              checkout_session_id: session.id,
            },
          })
          .returning()
        
        if (!payment) {
          throw new Error('Failed to create payment record')
        }
        
        logger.info('Payment record created', {
          paymentId: payment.id,
          tabId: payment.tabId
        })
        
        // Update tab paid amount
        const tab = await db.query.tabs.findFirst({
          where: (tabs, { eq }) => eq(tabs.id, tabId),
        })
        
        if (tab) {
          const newPaidAmount = parseFloat(tab.paidAmount) + parseFloat(payment.amount)
          const newStatus = newPaidAmount >= parseFloat(tab.totalAmount) ? 'paid' : 'partial'
          
          logger.info('Updating tab', {
            tabId: tab.id,
            oldPaidAmount: tab.paidAmount,
            newPaidAmount,
            newStatus,
          })
          
          await db
            .update(tabs)
            .set({
              paidAmount: newPaidAmount.toFixed(2),
              status: newStatus,
              updatedAt: new Date(),
            })
            .where(eq(tabs.id, tab.id))
            
          logger.info('Tab updated successfully', {
            tabId: tab.id
          })
        } else {
          logger.error('Tab not found', undefined, {
            tabId
          })
        }
        break
      }
      
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        
        // Update payment record
        const [payment] = await db
          .update(payments)
          .set({
            status: 'succeeded',
            metadata: {
              stripe_event_id: event.id,
            },
          })
          .where(eq(payments.processorPaymentId, paymentIntent.id))
          .returning()

        if (payment) {
          // Update tab paid amount
          const tab = await db.query.tabs.findFirst({
            where: (tabs, { eq }) => eq(tabs.id, payment.tabId),
          })

          if (tab) {
            const newPaidAmount = parseFloat(tab.paidAmount) + parseFloat(payment.amount)
            const newStatus = newPaidAmount >= parseFloat(tab.totalAmount) ? 'paid' : 'partial'

            await db
              .update(tabs)
              .set({
                paidAmount: newPaidAmount.toFixed(2),
                status: newStatus,
                updatedAt: new Date(),
              })
              .where(eq(tabs.id, tab.id))
          }
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        
        // Update payment record
        await db
          .update(payments)
          .set({
            status: 'failed',
            failureReason: paymentIntent.last_payment_error?.message,
            metadata: {
              stripe_event_id: event.id,
              error_code: paymentIntent.last_payment_error?.code,
            },
          })
          .where(eq(payments.processorPaymentId, paymentIntent.id))
        break
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute
        
        // Find payment by charge ID
        const payment = await db.query.payments.findFirst({
          where: (payments, { eq }) => eq(payments.processorPaymentId, dispute.payment_intent as string),
        })

        if (payment) {
          // Update tab status
          await db
            .update(tabs)
            .set({
              status: 'disputed',
              updatedAt: new Date(),
            })
            .where(eq(tabs.id, payment.tabId))

          // You might want to notify the merchant here
        }
        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        
        // Update payment record
        await db
          .update(payments)
          .set({
            status: charge.refunded ? 'refunded' : 'partially_refunded',
            metadata: {
              stripe_event_id: event.id,
              refund_amount: charge.amount_refunded,
            },
          })
          .where(eq(payments.processorPaymentId, charge.payment_intent as string))

        // Update tab if fully refunded
        if (charge.refunded) {
          const payment = await db.query.payments.findFirst({
            where: (payments, { eq }) => eq(payments.processorPaymentId, charge.payment_intent as string),
          })

          if (payment) {
            const tab = await db.query.tabs.findFirst({
              where: (tabs, { eq }) => eq(tabs.id, payment.tabId),
            })

            if (tab) {
              const newPaidAmount = Math.max(0, parseFloat(tab.paidAmount) - parseFloat(payment.amount))
              
              await db
                .update(tabs)
                .set({
                  paidAmount: newPaidAmount.toFixed(2),
                  status: newPaidAmount === 0 ? 'open' : 'partial',
                  updatedAt: new Date(),
                })
                .where(eq(tabs.id, tab.id))
            }
          }
        }
        break
      }

      default:
        logger.debug('Unhandled webhook event type', {
          eventType: event.type,
          eventId: event.id
        })
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error('Error processing webhook', error as Error, {
      eventType: event.type,
      eventId: event.id
    })
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}