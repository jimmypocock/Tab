/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/v1/webhooks/stripe/route'
import { db } from '@/lib/db/client'
import Stripe from 'stripe'

// Mock Stripe constructor
jest.mock('stripe', () => {
  const mockConstructEvent = jest.fn().mockImplementation(() => {
    console.log('constructEvent mock called!')
    return {
      id: 'evt_test123',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test123',
          amount: 10000,
          currency: 'usd',
          status: 'succeeded'
        }
      }
    }
  })

  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: mockConstructEvent,
    },
    paymentIntents: {
      retrieve: jest.fn(),
    },
  }))
})

// Mock database client
jest.mock('@/lib/db/client', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn().mockImplementation(() => ({
      values: jest.fn().mockImplementation(() => ({
        returning: jest.fn().mockResolvedValue([{
          id: 'payment_123',
          tabId: 'tab_123',
          amount: '100.00',
          status: 'succeeded'
        }])
      }))
    })),
    update: jest.fn().mockImplementation(() => ({
      set: jest.fn().mockImplementation(() => ({
        where: jest.fn().mockImplementation(() => ({
          returning: jest.fn().mockResolvedValue([{
            id: 'payment_123',
            tabId: 'tab_123',
            amount: '100.00',
            status: 'succeeded'
          }])
        }))
      }))
    })),
    query: {
      tabs: {
        findFirst: jest.fn(),
      },
      merchants: {
        findFirst: jest.fn(),
      },
      payments: {
        findFirst: jest.fn(),
      }
    },
    transaction: jest.fn().mockImplementation((callback) => 
      callback({
        insert: jest.fn().mockImplementation(() => ({
          values: jest.fn().mockImplementation(() => ({
            returning: jest.fn().mockResolvedValue([{
              id: 'payment_123',
              tabId: 'tab_123',
              amount: '100.00',
              status: 'succeeded'
            }])
          }))
        })),
        update: jest.fn().mockImplementation(() => ({
          set: jest.fn().mockImplementation(() => ({
            where: jest.fn().mockImplementation(() => ({
              returning: jest.fn().mockResolvedValue([{
                id: 'tab_123',
                status: 'paid',
                paidAmount: '100.00'
              }])
            }))
          }))
        }))
      })
    )
  }
}))

const mockDb = db as jest.Mocked<typeof db>

// Get access to the mocked constructEvent function
const mockStripe = new (Stripe as jest.MockedClass<typeof Stripe>)()
const mockConstructEvent = mockStripe.webhooks.constructEvent as jest.MockedFunction<any>

describe('/api/v1/webhooks/stripe', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const mockPaymentIntent = {
    id: 'pi_test123',
    amount: 10000,
    currency: 'usd',
    status: 'succeeded',
    metadata: {
      tabId: 'tab_123',
      merchantId: 'merchant_123'
    }
  }

  const mockTab = {
    id: 'tab_123',
    merchantId: 'merchant_123',
    status: 'open',
    totalAmount: 10000,
    customerName: 'John Doe',
    customerEmail: 'john@example.com'
  }

  describe('payment_intent.succeeded', () => {
    it('should process successful payment webhook', async () => {
      // Mock an existing payment record that needs to be updated
      const existingPayment = {
        id: 'payment_123',
        tabId: 'tab_123',
        processorPaymentId: 'pi_test123',
        amount: '100.00',
        status: 'pending'
      }
      
      const mockEvent = {
        id: 'evt_test123',
        type: 'payment_intent.succeeded',
        data: {
          object: mockPaymentIntent
        },
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        object: 'event',
        pending_webhooks: 1,
        request: null,
        api_version: '2020-08-27'
      }
      mockConstructEvent.mockReturnValue(mockEvent as any)

      // Mock database queries - payment update flow
      mockDb.query.tabs.findFirst.mockResolvedValue({
        ...mockTab,
        paidAmount: '0.00'
      })

      const webhookBody = JSON.stringify({
        id: 'evt_test123',
        type: 'payment_intent.succeeded',
        data: { object: mockPaymentIntent }
      })

      const request = new NextRequest('http://localhost/api/v1/webhooks/stripe', {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
          'Content-Type': 'application/json'
        },
        body: webhookBody
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockConstructEvent).toHaveBeenCalledWith(
        webhookBody,
        'test_signature',
        process.env.STRIPE_WEBHOOK_SECRET
      )
    })

    it('should handle duplicate payment webhooks', async () => {
      // Mock webhook validation
      const mockEvent = {
        id: 'evt_test123',
        type: 'payment_intent.succeeded',
        data: {
          object: mockPaymentIntent
        },
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        object: 'event',
        pending_webhooks: 1,
        request: null,
        api_version: '2020-08-27'
      }
      mockConstructEvent.mockReturnValue(mockEvent as any)

      // Mock existing payment
      mockDb.query.payments.findFirst.mockResolvedValue({
        id: 'payment_123',
        stripePaymentIntentId: 'pi_test123',
        status: 'completed'
      })

      const webhookBody = JSON.stringify({
        id: 'evt_test123',
        type: 'payment_intent.succeeded',
        data: { object: mockPaymentIntent }
      })

      const request = new NextRequest('http://localhost/api/v1/webhooks/stripe', {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
          'Content-Type': 'application/json'
        },
        body: webhookBody
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      // Should not create duplicate payment
      expect(mockDb.transaction).not.toHaveBeenCalled()
    })

    it('should handle tab not found in webhook', async () => {
      const mockEvent = {
        id: 'evt_test123',
        type: 'payment_intent.succeeded',
        data: {
          object: mockPaymentIntent
        },
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        object: 'event',
        pending_webhooks: 1,
        request: null,
        api_version: '2020-08-27'
      }
      mockConstructEvent.mockReturnValue(mockEvent as any)

      // Mock tab not found - but payment update should return empty array (no payment found)
      mockDb.query.tabs.findFirst.mockResolvedValue(null)
      mockDb.query.payments.findFirst.mockResolvedValue(null)
      
      // Override the update mock to return empty array (no payment updated)
      mockDb.update.mockImplementation(() => ({
        set: jest.fn().mockImplementation(() => ({
          where: jest.fn().mockImplementation(() => ({
            returning: jest.fn().mockResolvedValue([]) // No payment found to update
          }))
        }))
      }))

      const webhookBody = JSON.stringify({
        id: 'evt_test123',
        type: 'payment_intent.succeeded',
        data: { object: mockPaymentIntent }
      })

      const request = new NextRequest('http://localhost/api/v1/webhooks/stripe', {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
          'Content-Type': 'application/json'
        },
        body: webhookBody
      })

      const response = await POST(request)
      const data = await response.json()

      // Webhook should return 200 even when tab is not found (to acknowledge receipt)
      expect(response.status).toBe(200)
      expect(data.received).toBe(true)
    })

    it('should validate webhook signature', async () => {
      // Mock signature validation failure
      mockConstructEvent.mockImplementation(() => {
        throw new Error('Invalid signature')
      })

      const request = new NextRequest('http://localhost/api/v1/webhooks/stripe', {
        method: 'POST',
        headers: {
          'stripe-signature': 'invalid_signature',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ test: 'data' })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid signature')
    })

    it('should require stripe-signature header', async () => {
      const request = new NextRequest('http://localhost/api/v1/webhooks/stripe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
          // Missing stripe-signature
        },
        body: JSON.stringify({ test: 'data' })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid signature')
    })
  })

  describe('payment_intent.payment_failed', () => {
    it('should handle failed payment webhook', async () => {
      const failedPaymentIntent = {
        ...mockPaymentIntent,
        status: 'requires_payment_method',
        last_payment_error: {
          message: 'Your card was declined.'
        }
      }

      const mockEvent = {
        id: 'evt_test123',
        type: 'payment_intent.payment_failed',
        data: {
          object: failedPaymentIntent
        },
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        object: 'event',
        pending_webhooks: 1,
        request: null,
        api_version: '2020-08-27'
      }
      mockConstructEvent.mockReturnValue(mockEvent as any)

      mockDb.query.tabs.findFirst.mockResolvedValue(mockTab)

      // Base mock will handle transaction

      const webhookBody = JSON.stringify({
        id: 'evt_test123',
        type: 'payment_intent.payment_failed',
        data: { object: failedPaymentIntent }
      })

      const request = new NextRequest('http://localhost/api/v1/webhooks/stripe', {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
          'Content-Type': 'application/json'
        },
        body: webhookBody
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
    })
  })

  describe('unhandled webhook types', () => {
    it('should return 200 for unhandled webhook types', async () => {
      const mockEvent = {
        id: 'evt_test123',
        type: 'customer.created',
        data: {
          object: { id: 'cus_test123' }
        },
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        object: 'event',
        pending_webhooks: 1,
        request: null,
        api_version: '2020-08-27'
      }
      mockConstructEvent.mockReturnValue(mockEvent as any)

      const webhookBody = JSON.stringify({
        id: 'evt_test123',
        type: 'customer.created',
        data: { object: { id: 'cus_test123' } }
      })

      const request = new NextRequest('http://localhost/api/v1/webhooks/stripe', {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
          'Content-Type': 'application/json'
        },
        body: webhookBody
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.received).toBe(true)
    })
  })

  describe('database error handling', () => {
    afterEach(() => {
      // Restore the base database mocks after error tests
      mockDb.update.mockImplementation(() => ({
        set: jest.fn().mockImplementation(() => ({
          where: jest.fn().mockImplementation(() => ({
            returning: jest.fn().mockResolvedValue([{
              id: 'payment_123',
              tabId: 'tab_123',
              amount: '100.00',
              status: 'succeeded'
            }])
          }))
        }))
      }))
      
      mockDb.query.tabs.findFirst.mockResolvedValue(mockTab)
      mockDb.query.payments.findFirst.mockResolvedValue(null)
    })

    it('should handle database errors gracefully', async () => {
      // Mock the constructEvent to return valid event
      const mockEvent = {
        id: 'evt_test123',
        type: 'payment_intent.succeeded',
        data: {
          object: mockPaymentIntent
        },
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        object: 'event',
        pending_webhooks: 1,
        request: null,
        api_version: '2020-08-27'
      }
      mockConstructEvent.mockReturnValue(mockEvent as any)

      // Mock db.update to return an object that throws when set() is called
      mockDb.update.mockImplementation(() => ({
        set: jest.fn().mockImplementation(() => {
          throw new Error('Database connection failed')
        })
      }))

      const webhookBody = JSON.stringify({
        id: 'evt_test123',
        type: 'payment_intent.succeeded',
        data: { object: mockPaymentIntent }
      })

      const request = new NextRequest('http://localhost/api/v1/webhooks/stripe', {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
          'Content-Type': 'application/json'
        },
        body: webhookBody
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Webhook processing failed')
    })
  })

  describe('database transaction handling', () => {
    beforeEach(() => {
      // Ensure clean mocks for transaction tests
      mockDb.query.tabs.findFirst.mockResolvedValue(mockTab)
      mockDb.query.payments.findFirst.mockResolvedValue(null)
      // Reset update mock to working state
      mockDb.update.mockImplementation(() => ({
        set: jest.fn().mockImplementation(() => ({
          where: jest.fn().mockImplementation(() => ({
            returning: jest.fn().mockResolvedValue([{
              id: 'payment_123',
              tabId: 'tab_123',
              amount: '50.00',
              status: 'succeeded'
            }])
          }))
        }))
      }))
    })

    it('should handle partial payment amounts', async () => {
      const partialPaymentIntent = {
        ...mockPaymentIntent,
        amount: 5000, // Only half of the tab amount
        amount_received: 5000
      }

      const mockEvent = {
        id: 'evt_test123',
        type: 'payment_intent.succeeded',
        data: {
          object: partialPaymentIntent
        },
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        object: 'event',
        pending_webhooks: 1,
        request: null,
        api_version: '2020-08-27'
      }
      mockConstructEvent.mockReturnValue(mockEvent as any)

      mockDb.query.tabs.findFirst.mockResolvedValue(mockTab)
      mockDb.query.payments.findFirst.mockResolvedValue(null)

      // Base mock will handle transaction

      const webhookBody = JSON.stringify({
        id: 'evt_test123',
        type: 'payment_intent.succeeded',
        data: { object: partialPaymentIntent }
      })

      const request = new NextRequest('http://localhost/api/v1/webhooks/stripe', {
        method: 'POST',
        headers: {
          'stripe-signature': 'test_signature',
          'Content-Type': 'application/json'
        },
        body: webhookBody
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
    })
  })
})