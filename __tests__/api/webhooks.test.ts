/**
 * @jest-environment node
 */
import { testApiHandler } from 'next-test-api-route-handler'
import * as webhookHandler from '@/app/api/v1/webhooks/stripe/route'
import { stripe } from '@/lib/stripe/client'
import { db } from '@/lib/db/client'

// Mock Stripe
jest.mock('@/lib/stripe/client', () => ({
  stripe: {
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
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    transaction: jest.fn(),
  },
}))

describe('/api/v1/webhooks/stripe', () => {
  const mockDb = db as any
  const mockStripe = stripe as any
  const mockWebhookSecret = 'whsec_test_secret'
  
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.STRIPE_WEBHOOK_SECRET = mockWebhookSecret
  })

  describe('POST - payment_intent.succeeded', () => {
    it('should process successful payment webhook', async () => {
      const webhookPayload = {
        id: 'evt_test_123',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_123',
            amount: 5000,
            currency: 'usd',
            status: 'succeeded',
            charges: {
              data: [{
                id: 'ch_test_123',
                receipt_url: 'https://receipt.stripe.com/123'
              }]
            },
            metadata: {
              tabId: 'tab_123',
              merchantId: 'merchant_123',
              paymentId: 'payment_123'
            }
          }
        }
      }

      // Mock Stripe webhook verification
      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload)

      // Mock transaction for updating payment and tab
      mockDb.transaction.mockImplementation(async (fn: any) => {
        const tx = {
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([{ status: 'succeeded' }]),
          select: jest.fn().mockReturnThis(),
          from: jest.fn().mockReturnThis(),
        }
        
        // Mock getting current tab state
        tx.where.mockResolvedValue([{
          id: 'tab_123',
          total: '100.00',
          paidAmount: '0.00'
        }])
        
        return fn(tx)
      })

      await testApiHandler({
        handler: webhookHandler.POST,
        test: async ({ fetch }) => {
          const response = await fetch({
            method: 'POST',
            headers: {
              'stripe-signature': 'test_signature',
              'content-type': 'application/json',
            },
            body: JSON.stringify(webhookPayload),
          })

          expect(response.status).toBe(200)
          expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
            expect.any(String),
            'test_signature',
            mockWebhookSecret
          )
          expect(mockDb.transaction).toHaveBeenCalled()
        },
      })
    })

    it('should reject invalid webhook signature', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Webhook signature verification failed')
      })

      await testApiHandler({
        handler: webhookHandler.POST,
        test: async ({ fetch }) => {
          const response = await fetch({
            method: 'POST',
            headers: {
              'stripe-signature': 'invalid_signature',
              'content-type': 'application/json',
            },
            body: JSON.stringify({ type: 'payment_intent.succeeded' }),
          })

          expect(response.status).toBe(400)
          const json = await response.json()
          expect(json.error).toContain('Invalid signature')
        },
      })
    })
  })

  describe('POST - charge.refunded', () => {
    it('should process refund webhook', async () => {
      const webhookPayload = {
        id: 'evt_refund_123',
        type: 'charge.refunded',
        data: {
          object: {
            id: 'ch_test_123',
            amount: 10000, // $100
            amount_refunded: 2500, // $25 refund
            currency: 'usd',
            refunded: false,
            metadata: {
              tabId: 'tab_123',
              paymentId: 'payment_123'
            }
          }
        }
      }

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload)

      // Mock database operations
      mockDb.transaction.mockImplementation(async (fn: any) => {
        const tx = {
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([{
            status: 'partially_refunded',
            refundedAmount: '25.00'
          }]),
          select: jest.fn().mockReturnThis(),
          from: jest.fn().mockReturnThis(),
        }
        
        // Mock current tab state
        tx.where.mockResolvedValue([{
          id: 'tab_123',
          total: '100.00',
          paidAmount: '100.00'
        }])
        
        return fn(tx)
      })

      await testApiHandler({
        handler: webhookHandler.POST,
        test: async ({ fetch }) => {
          const response = await fetch({
            method: 'POST',
            headers: {
              'stripe-signature': 'test_signature',
              'content-type': 'application/json',
            },
            body: JSON.stringify(webhookPayload),
          })

          expect(response.status).toBe(200)
          expect(mockDb.transaction).toHaveBeenCalled()
        },
      })
    })
  })

  describe('POST - payment_intent.payment_failed', () => {
    it('should handle payment failure webhook', async () => {
      const webhookPayload = {
        id: 'evt_failed_123',
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_failed_123',
            status: 'requires_payment_method',
            last_payment_error: {
              code: 'card_declined',
              message: 'Your card was declined.',
              decline_code: 'insufficient_funds'
            },
            metadata: {
              paymentId: 'payment_123'
            }
          }
        }
      }

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload)

      mockDb.update.mockReturnThis()
      mockDb.set.mockReturnThis()
      mockDb.where.mockReturnThis()
      mockDb.returning.mockResolvedValue([{
        id: 'payment_123',
        status: 'failed',
        failureCode: 'card_declined'
      }])

      await testApiHandler({
        handler: webhookHandler.POST,
        test: async ({ fetch }) => {
          const response = await fetch({
            method: 'POST',
            headers: {
              'stripe-signature': 'test_signature',
              'content-type': 'application/json',
            },
            body: JSON.stringify(webhookPayload),
          })

          expect(response.status).toBe(200)
          expect(mockDb.update).toHaveBeenCalled()
        },
      })
    })
  })

  describe('POST - unknown event type', () => {
    it('should handle unknown webhook events gracefully', async () => {
      const webhookPayload = {
        id: 'evt_unknown_123',
        type: 'unknown.event.type',
        data: {
          object: { id: 'unknown_123' }
        }
      }

      mockStripe.webhooks.constructEvent.mockReturnValue(webhookPayload)

      await testApiHandler({
        handler: webhookHandler.POST,
        test: async ({ fetch }) => {
          const response = await fetch({
            method: 'POST',
            headers: {
              'stripe-signature': 'test_signature',
              'content-type': 'application/json',
            },
            body: JSON.stringify(webhookPayload),
          })

          // Should still return 200 to prevent Stripe retries
          expect(response.status).toBe(200)
        },
      })
    })
  })
})