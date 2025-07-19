import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import { payments } from '@/lib/db/schema'
import { createApiResponse, createApiError, parseJsonBody } from '@/lib/api/middleware'
import { createPaymentIntent } from '@/lib/stripe/client'
import { z } from 'zod'

const createPaymentIntentSchema = z.object({
  tabId: z.string().uuid(),
  amount: z.number().positive(),
  email: z.string().email(),
})

export async function POST(request: NextRequest) {
  // Parse and validate request body
  const body = await parseJsonBody(request)
  if (!body) {
    return createApiError('Invalid JSON body', 400)
  }

  const validation = createPaymentIntentSchema.safeParse(body)
  if (!validation.success) {
    return createApiError('Invalid request data', 400, 'VALIDATION_ERROR', validation.error.issues)
  }

  const data = validation.data

  try {
    // Fetch the tab (no auth required for public payments)
    const tab = await db.query.tabs.findFirst({
      where: (tabs, { eq }) => eq(tabs.id, data.tabId),
    })

    if (!tab) {
      return createApiError('Tab not found', 404, 'NOT_FOUND')
    }

    // Check if tab is already paid
    const balance = parseFloat(tab.totalAmount) - parseFloat(tab.paidAmount)
    if (balance <= 0) {
      return createApiError('Tab is already paid', 400, 'ALREADY_PAID')
    }

    // Validate payment amount
    if (data.amount > balance) {
      return createApiError('Payment amount exceeds balance', 400, 'AMOUNT_EXCEEDS_BALANCE', {
        balance: balance.toFixed(2),
        requested: data.amount.toFixed(2),
      })
    }

    // Create Stripe payment intent
    const paymentIntent = await createPaymentIntent(
      data.amount,
      tab.currency.toLowerCase(),
      {
        tab_id: tab.id,
        merchant_id: tab.merchantId,
        customer_email: data.email,
      }
    )

    // Create payment record (in pending state)
    await db.insert(payments).values({
      tabId: data.tabId,
      amount: data.amount.toFixed(2),
      currency: tab.currency,
      status: 'pending',
      processor: 'stripe',
      processorPaymentId: paymentIntent.id,
      metadata: {
        customer_email: data.email,
        public_payment: true,
      },
    })

    return createApiResponse({
      clientSecret: paymentIntent.client_secret,
    })
  } catch (error) {
    console.error('Error creating payment intent:', error)
    return createApiError('Failed to create payment', 500, 'INTERNAL_ERROR')
  }
}