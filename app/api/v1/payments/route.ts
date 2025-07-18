import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import { tabs, payments } from '@/lib/db/schema'
import { validateApiKey, createApiResponse, createApiError, parseJsonBody } from '@/lib/api/middleware'
import { createPaymentSchema } from '@/lib/api/validation'
import { createPaymentIntent } from '@/lib/stripe/client'
import { eq, and } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  // Validate API key
  const { valid, context, error } = await validateApiKey(request)
  if (!valid) {
    return createApiError((error as Error)?.message || 'Unauthorized', 401)
  }

  // Parse and validate request body
  const body = await parseJsonBody(request)
  if (!body) {
    return createApiError('Invalid JSON body', 400)
  }

  const validation = createPaymentSchema.safeParse(body)
  if (!validation.success) {
    return createApiError('Invalid request data', 400, 'VALIDATION_ERROR', validation.error.errors)
  }

  const data = validation.data

  try {
    // Fetch the tab
    const tab = await db.query.tabs.findFirst({
      where: (tabs, { eq, and }) => 
        and(
          eq(tabs.id, data.tabId),
          eq(tabs.merchantId, context!.merchantId)
        ),
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
        merchant_id: context!.merchantId,
        customer_email: tab.customerEmail,
      }
    )

    // Create payment record
    const [payment] = await db.insert(payments).values({
      tabId: data.tabId,
      amount: data.amount.toFixed(2),
      currency: tab.currency,
      status: 'pending',
      processor: 'stripe',
      processorPaymentId: paymentIntent.id,
      metadata: data.metadata,
    }).returning()

    return createApiResponse({
      payment,
      clientSecret: paymentIntent.client_secret,
      publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    }, 201)
  } catch (error) {
    console.error('Error creating payment:', error)
    return createApiError('Failed to create payment', 500, 'INTERNAL_ERROR')
  }
}

export async function GET(request: NextRequest) {
  // Validate API key
  const { valid, context, error } = await validateApiKey(request)
  if (!valid) {
    return createApiError((error as Error)?.message || 'Unauthorized', 401)
  }

  try {
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const tabId = searchParams.get('tab_id')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query conditions
    const conditions = []
    
    if (tabId) {
      // Verify tab belongs to merchant
      const tab = await db.query.tabs.findFirst({
        where: (tabs, { eq, and }) => 
          and(
            eq(tabs.id, tabId),
            eq(tabs.merchantId, context!.merchantId)
          ),
      })
      
      if (!tab) {
        return createApiError('Tab not found', 404, 'NOT_FOUND')
      }
      
      conditions.push(eq(payments.tabId, tabId))
    }
    
    if (status) {
      conditions.push(eq(payments.status, status))
    }

    // Fetch payments
    const results = await db.query.payments.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        tab: true,
      },
      limit: Math.min(limit, 100),
      offset,
      orderBy: (payments, { desc }) => [desc(payments.createdAt)],
    })

    // Filter out payments not belonging to merchant
    const filteredResults = results.filter(p => p.tab !== null)

    return createApiResponse({
      payments: filteredResults,
      pagination: {
        limit,
        offset,
        hasMore: filteredResults.length === limit,
      },
    })
  } catch (error) {
    console.error('Error fetching payments:', error)
    return createApiError('Failed to fetch payments', 500, 'INTERNAL_ERROR')
  }
}