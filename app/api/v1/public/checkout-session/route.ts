import { NextRequest } from 'next/server'
import { createSuccessResponse, createErrorResponse } from '@/lib/api/response'
import { ValidationError } from '@/lib/errors'
import { stripe } from '@/lib/stripe/client'
import { db } from '@/lib/db/client'
import { tabs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tabId, amount, email } = body

    if (!tabId || !email) {
      throw new ValidationError('Tab ID and email are required')
    }

    // Fetch the tab
    const [tab] = await db
      .select()
      .from(tabs)
      .where(eq(tabs.id, tabId))
      .limit(1)

    if (!tab) {
      throw new ValidationError('Tab not found')
    }

    // Calculate balance
    const balance = parseFloat(tab.totalAmount) - parseFloat(tab.paidAmount)
    const paymentAmount = amount || balance

    if (paymentAmount <= 0 || paymentAmount > balance) {
      throw new ValidationError('Invalid payment amount')
    }

    // Get merchant info for display
    const merchant = await db.query.merchants.findFirst({
      where: (merchants, { eq }) => eq(merchants.id, tab.merchantId),
    })

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: tab.currency.toLowerCase(),
            product_data: {
              name: `Payment for Tab #${tab.id.slice(0, 8)}`,
              description: merchant?.businessName || 'Tab Payment',
            },
            unit_amount: Math.round(paymentAmount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/pay/${tabId}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pay/${tabId}`,
      metadata: {
        tabId: tab.id,
        amount: paymentAmount.toString(),
        environment: process.env.NODE_ENV === 'development' ? 'test' : 'live',
      },
      payment_intent_data: {
        metadata: {
          tabId: tab.id,
          merchantId: tab.merchantId,
        },
      },
    })

    return createSuccessResponse({ 
      sessionId: session.id,
      url: session.url 
    })
  } catch (error) {
    return createErrorResponse(error)
  }
}