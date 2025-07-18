import { POST as createCheckoutSession } from '@/app/api/v1/public/checkout-session/route'
import { POST as stripeWebhook } from '@/app/api/v1/webhooks/stripe/route'
import { stripe } from '@/lib/stripe/client'
import { db } from '@/lib/db/client'
import { tabs, payments } from '@/lib/db/schema'
import { NextRequest } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { eq } from 'drizzle-orm'

// Mock Stripe
jest.mock('@/lib/stripe/client', () => ({
  stripe: {
    checkout: {
      sessions: {
        create: jest.fn(),
      },
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  },
}))

// Mock database
jest.mock('@/lib/db/client', () => ({
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    query: {
      tabs: {
        findFirst: jest.fn(),
      },
    },
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
  },
}))

describe('/api/v1/public/checkout-session', () => {
  const mockTab = {
    id: uuidv4(),
    merchantId: uuidv4(),
    customerEmail: 'customer@example.com',
    totalAmount: '100.00',
    paidAmount: '0.00',
    currency: 'USD',
    status: 'open',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST - Create Checkout Session', () => {
    it('should create a checkout session for valid tab', async () => {
      const mockSessionId = 'cs_test_123'
      const mockSessionUrl = 'https://checkout.stripe.com/test'
      
      ;(db.select as jest.Mock).mockResolvedValue([mockTab])
      ;(stripe.checkout.sessions.create as jest.Mock).mockResolvedValue({
        id: mockSessionId,
        url: mockSessionUrl,
      })

      const request = new NextRequest('http://localhost:3000/api/v1/public/checkout-session', {
        method: 'POST',
        body: JSON.stringify({
          tabId: mockTab.id,
          email: 'customer@example.com',
        }),
      })

      const response = await createCheckoutSession(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.sessionId).toBe(mockSessionId)
      expect(data.data.url).toBe(mockSessionUrl)
      
      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith({
        payment_method_types: ['card'],
        customer_email: 'customer@example.com',
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: expect.stringContaining('Payment for Tab'),
              description: expect.any(String),
            },
            unit_amount: 10000, // $100.00 in cents
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: expect.stringContaining(`/pay/${mockTab.id}/success`),
        cancel_url: expect.stringContaining(`/pay/${mockTab.id}`),
        metadata: {
          tabId: mockTab.id,
          amount: '100',
          environment: 'test',
        },
        payment_intent_data: {
          metadata: {
            tabId: mockTab.id,
            merchantId: mockTab.merchantId,
          },
        },
      })
    })

    it('should handle partial payment amount', async () => {
      ;(db.select as jest.Mock).mockResolvedValue([mockTab])
      ;(stripe.checkout.sessions.create as jest.Mock).mockResolvedValue({
        id: 'cs_test_456',
        url: 'https://checkout.stripe.com/test',
      })

      const request = new NextRequest('http://localhost:3000/api/v1/public/checkout-session', {
        method: 'POST',
        body: JSON.stringify({
          tabId: mockTab.id,
          email: 'customer@example.com',
          amount: 50, // Partial payment
        }),
      })

      const response = await createCheckoutSession(request)
      
      expect(response.status).toBe(200)
      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{
            price_data: expect.objectContaining({
              unit_amount: 5000, // $50.00 in cents
            }),
            quantity: 1,
          }],
          metadata: expect.objectContaining({
            amount: '50',
          }),
        })
      )
    })

    it('should reject payment exceeding balance', async () => {
      const paidTab = { ...mockTab, paidAmount: '75.00' }
      ;(db.select as jest.Mock).mockResolvedValue([paidTab])

      const request = new NextRequest('http://localhost:3000/api/v1/public/checkout-session', {
        method: 'POST',
        body: JSON.stringify({
          tabId: mockTab.id,
          email: 'customer@example.com',
          amount: 50, // Would exceed balance (only $25 remaining)
        }),
      })

      const response = await createCheckoutSession(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid payment amount')
    })

    it('should reject missing required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/public/checkout-session', {
        method: 'POST',
        body: JSON.stringify({
          tabId: mockTab.id,
          // Missing email
        }),
      })

      const response = await createCheckoutSession(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Tab ID and email are required')
    })

    it('should handle non-existent tab', async () => {
      ;(db.select as jest.Mock).mockResolvedValue([])

      const request = new NextRequest('http://localhost:3000/api/v1/public/checkout-session', {
        method: 'POST',
        body: JSON.stringify({
          tabId: uuidv4(),
          email: 'customer@example.com',
        }),
      })

      const response = await createCheckoutSession(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Tab not found')
    })
  })
})

describe('Stripe Checkout Webhook', () => {
  const mockTabId = uuidv4()
  const mockPaymentIntentId = 'pi_test_123'
  const mockSessionId = 'cs_test_123'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should process checkout.session.completed webhook', async () => {
    const mockEvent = {
      id: 'evt_test_123',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: mockSessionId,
          payment_intent: mockPaymentIntentId,
          amount_total: 10000, // $100.00 in cents
          currency: 'usd',
          metadata: {
            tabId: mockTabId,
            amount: '100',
            environment: 'test',
          },
        },
      },
    }

    const mockTab = {
      id: mockTabId,
      paidAmount: '0.00',
      totalAmount: '100.00',
    }

    ;(stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(mockEvent)
    ;(db.insert as jest.Mock).mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([{
          id: uuidv4(),
          amount: '100.00',
        }]),
      }),
    })
    ;(db.query.tabs.findFirst as jest.Mock).mockResolvedValue(mockTab)
    ;(db.update as jest.Mock).mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(true),
      }),
    })

    const request = new NextRequest('http://localhost:3000/api/v1/webhooks/stripe', {
      method: 'POST',
      headers: {
        'stripe-signature': 'test_signature',
      },
      body: JSON.stringify(mockEvent),
    })

    const response = await stripeWebhook(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.received).toBe(true)

    // Verify payment was created
    expect(db.insert).toHaveBeenCalledWith(payments)
    
    // Verify tab was updated
    expect(db.update).toHaveBeenCalledWith(tabs)
  })

  it('should handle invalid webhook signature', async () => {
    ;(stripe.webhooks.constructEvent as jest.Mock).mockImplementation(() => {
      throw new Error('Invalid signature')
    })

    const request = new NextRequest('http://localhost:3000/api/v1/webhooks/stripe', {
      method: 'POST',
      headers: {
        'stripe-signature': 'invalid_signature',
      },
      body: 'test_body',
    })

    const response = await stripeWebhook(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid signature')
  })
})