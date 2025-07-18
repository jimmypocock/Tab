/**
 * @jest-environment node
 */
import { testApiHandler } from 'next-test-api-route-handler'
import * as publicTabHandler from '@/app/api/v1/public/tabs/(id)/route'
import * as publicIntentHandler from '@/app/api/v1/public/public-intent/route'
import { db } from '@/lib/db/client'
import { stripe } from '@/lib/stripe/client'

// Mock database
jest.mock('@/lib/db/client', () => ({
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
  },
}))

// Mock Stripe
jest.mock('@/lib/stripe/client', () => ({
  stripe: {
    paymentIntents: {
      create: jest.fn(),
    },
  },
}))

describe('Public Payment APIs', () => {
  const mockDb = db as any
  const mockStripe = stripe as any
  
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/v1/public/tabs/:id', () => {
    it('should return tab details without authentication', async () => {
      const tabId = 'tab_public_123'
      const mockTab = {
        tabs: {
          id: tabId,
          customerEmail: 'customer@example.com',
          customerName: 'Test Customer',
          subtotal: '100.00',
          taxAmount: '8.00',
          total: '108.00',
          paidAmount: '50.00',
          status: 'partial',
          currency: 'USD',
          metadata: { orderId: '12345' }
        },
        merchants: {
          id: 'merchant_123',
          name: 'Test Merchant',
          businessName: 'Test Business Inc.'
        }
      }

      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockResolvedValue([mockTab])
      }))

      await testApiHandler({
        handler: publicTabHandler.GET,
        params: { id: tabId },
        test: async ({ fetch }) => {
          const response = await fetch({ method: 'GET' })

          expect(response.status).toBe(200)
          const json = await response.json()
          
          expect(json.data).toMatchObject({
            id: tabId,
            total: '108.00',
            paidAmount: '50.00',
            balanceDue: '58.00',
            status: 'partial',
            merchant: {
              name: 'Test Merchant'
            }
          })
          // Should not expose sensitive merchant data
          expect(json.data.merchant.id).toBeUndefined()
        },
      })
    })

    it('should return 404 for non-existent tab', async () => {
      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockResolvedValue([])
      }))

      await testApiHandler({
        handler: publicTabHandler.GET,
        params: { id: 'non_existent_tab' },
        test: async ({ fetch }) => {
          const response = await fetch({ method: 'GET' })

          expect(response.status).toBe(404)
          const json = await response.json()
          expect(json.error).toContain('Tab not found')
        },
      })
    })
  })

  describe('POST /api/v1/public/public-intent', () => {
    it('should create payment intent for valid tab', async () => {
      const tabId = 'tab_123'
      const paymentAmount = '58.00'
      
      // Mock tab lookup
      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockResolvedValue([{
          tabs: {
            id: tabId,
            merchantId: 'merchant_123',
            total: '108.00',
            paidAmount: '50.00',
            status: 'partial',
            currency: 'USD'
          },
          merchants: {
            id: 'merchant_123',
            stripeCustomerId: 'cus_test_123'
          }
        }])
      }))

      // Mock Stripe payment intent
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_test_123',
        amount: 5800, // $58.00 in cents
        currency: 'usd',
        client_secret: 'pi_test_secret_123',
        status: 'requires_payment_method'
      })

      // Mock payment record creation
      mockDb.insert.mockReturnThis()
      mockDb.values.mockReturnThis()
      mockDb.returning.mockResolvedValue([{
        id: 'payment_123',
        tabId,
        stripePaymentIntentId: 'pi_test_123',
        amount: paymentAmount,
        status: 'pending'
      }])

      await testApiHandler({
        handler: publicIntentHandler.POST,
        test: async ({ fetch }) => {
          const response = await fetch({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tabId,
              amount: paymentAmount
            }),
          })

          expect(response.status).toBe(200)
          const json = await response.json()
          
          expect(json.data).toMatchObject({
            clientSecret: 'pi_test_secret_123',
            amount: paymentAmount,
            currency: 'USD'
          })
          
          expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
            amount: 5800,
            currency: 'usd',
            automatic_payment_methods: { enabled: true },
            metadata: {
              tabId,
              merchantId: 'merchant_123'
            }
          })
        },
      })
    })

    it('should reject payment exceeding balance due', async () => {
      const tabId = 'tab_123'
      
      // Mock tab with small balance due
      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockResolvedValue([{
          tabs: {
            id: tabId,
            total: '100.00',
            paidAmount: '80.00', // Only $20 balance due
            status: 'partial',
            currency: 'USD'
          },
          merchants: { id: 'merchant_123' }
        }])
      }))

      await testApiHandler({
        handler: publicIntentHandler.POST,
        test: async ({ fetch }) => {
          const response = await fetch({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tabId,
              amount: '50.00' // Exceeds $20 balance
            }),
          })

          expect(response.status).toBe(400)
          const json = await response.json()
          expect(json.error).toContain('exceeds balance due')
        },
      })
    })

    it('should reject payment for voided tab', async () => {
      const tabId = 'tab_voided'
      
      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockResolvedValue([{
          tabs: {
            id: tabId,
            total: '100.00',
            paidAmount: '0.00',
            status: 'void', // Voided tab
            currency: 'USD'
          },
          merchants: { id: 'merchant_123' }
        }])
      }))

      await testApiHandler({
        handler: publicIntentHandler.POST,
        test: async ({ fetch }) => {
          const response = await fetch({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tabId,
              amount: '50.00'
            }),
          })

          expect(response.status).toBe(400)
          const json = await response.json()
          expect(json.error).toContain('voided')
        },
      })
    })

    it('should handle minimum payment amount', async () => {
      const tabId = 'tab_123'
      
      mockDb.select.mockImplementation(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockResolvedValue([{
          tabs: {
            id: tabId,
            total: '100.00',
            paidAmount: '99.50', // Only $0.50 balance due
            status: 'partial',
            currency: 'USD'
          },
          merchants: { id: 'merchant_123' }
        }])
      }))

      await testApiHandler({
        handler: publicIntentHandler.POST,
        test: async ({ fetch }) => {
          const response = await fetch({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tabId,
              amount: '0.40' // Below $0.50 minimum
            }),
          })

          expect(response.status).toBe(400)
          const json = await response.json()
          expect(json.error).toContain('Minimum payment')
        },
      })
    })
  })
})