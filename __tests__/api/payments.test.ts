/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/v1/payments/route'
import { db } from '@/lib/db/client'
import { merchants, tabs, lineItems, payments } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import Stripe from 'stripe'

// Mock the middleware
jest.mock('@/lib/api/organization-middleware', () => ({
  withOrganizationAuth: jest.fn((request, handler, options) => {
    // Mock organization context
    const mockContext = {
      organizationId: 'org_123',
      organization: {
        id: 'org_123',
        name: 'Test Organization',
        isMerchant: true,
        merchantId: 'merchant_123'
      },
      user: {
        id: 'user_123',
        email: 'test@example.com'
      },
      role: 'owner'
    }
    return handler(request, mockContext)
  })
}))

// Mock Stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: jest.fn(),
      retrieve: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  }))
})

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createServiceClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: { 
              id: 'test-merchant-id',
              stripeAccountId: 'acct_test123',
              businessName: 'Test Business' 
            },
            error: null
          }))
        }))
      }))
    }))
  }))
}))

// Mock database client
jest.mock('@/lib/db/client', () => ({
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    and: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    insert: jest.fn().mockImplementation(() => ({
      values: jest.fn().mockImplementation(() => ({
        returning: jest.fn().mockResolvedValue([{
          id: 'payment_123',
          tabId: '550e8400-e29b-41d4-a716-446655440000',
          amount: '100.00',
          status: 'pending',
          processorPaymentId: 'pi_test123'
        }])
      }))
    })),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    transaction: jest.fn(),
    query: {
      tabs: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      merchants: {
        findFirst: jest.fn(),
      },
      lineItems: {
        findMany: jest.fn(),
      },
      organizations: {
        findFirst: jest.fn()
      },
      merchantProcessors: {
        findFirst: jest.fn(),
      }
    }
  }
}))

// Mock MerchantProcessorService
jest.mock('@/lib/services/merchant-processor.service', () => ({
  MerchantProcessorService: {
    createProcessorInstance: jest.fn(() => Promise.resolve({
      createPaymentIntent: jest.fn().mockResolvedValue({
        processorPaymentId: 'pi_test123',
        clientSecret: 'pi_test123_secret_abc',
        amount: 10000,
        currency: 'usd',
        status: 'requires_payment_method'
      })
    })),
    getProcessor: jest.fn(() => Promise.resolve({
      id: 'processor_123',
      organizationId: 'org_123',
      processorType: 'stripe',
      isActive: true,
      isTestMode: true
    }))
  }
}))

const mockDb = db as jest.Mocked<typeof db>
const MockedStripe = Stripe as jest.MockedClass<typeof Stripe>

describe('/api/v1/payments', () => {
  let mockStripe: jest.Mocked<Stripe>

  beforeEach(() => {
    jest.clearAllMocks()
    mockStripe = new MockedStripe() as jest.Mocked<Stripe>
  })

  describe('POST - Create Payment Intent', () => {
    const mockTab = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      merchantId: 'merchant_123',
      organizationId: 'org_123',
      status: 'open',
      currency: 'USD',
      totalAmount: '100.00', // String format as expected by the route
      paidAmount: '0.00',    // String format as expected by the route
      customerName: 'John Doe',
      customerEmail: 'john@example.com'
    }

    const mockLineItems = [
      {
        id: 'item_1',
        tabId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Item',
        unitPrice: 5000,
        quantity: 2,
        totalPrice: 10000
      }
    ]

    const mockMerchant = {
      id: 'merchant_123',
      stripeAccountId: 'acct_test123',
      businessName: 'Test Business'
    }

    it('should create payment intent successfully', async () => {
      // Setup mocks
      mockDb.query.tabs.findFirst.mockResolvedValue(mockTab)
      mockDb.query.merchants.findFirst.mockResolvedValue(mockMerchant)
      mockDb.query.lineItems.findMany.mockResolvedValue(mockLineItems)
      
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_test123',
        client_secret: 'pi_test123_secret_abc',
        amount: 10000,
        currency: 'usd',
        status: 'requires_payment_method'
      } as any)

      const request = new NextRequest('http://localhost/api/v1/payments', {
        method: 'POST',
        headers: {
          'X-API-Key': 'tab_test_12345678901234567890123456789012',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tabId: '550e8400-e29b-41d4-a716-446655440000',
          amount: 100.00,
          metadata: {}
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data).toMatchObject({
        payment: {
          id: 'payment_123',
          tabId: '550e8400-e29b-41d4-a716-446655440000',
          amount: '100.00',
          status: 'pending',
          processorPaymentId: 'pi_test123'
        },
        paymentIntent: {
          amount: 10000,
          currency: 'usd',
          status: 'requires_payment_method'
        }
      })
    })

    it('should return 404 for non-existent tab', async () => {
      mockDb.query.tabs.findFirst.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/v1/payments', {
        method: 'POST',
        headers: {
          'X-API-Key': 'tab_test_12345678901234567890123456789012',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tabId: '550e8400-e29b-41d4-a716-446655440000', // Valid UUID format
          amount: 100.00,
          metadata: {}
        })
      })

      await expect(POST(request)).rejects.toThrow('Tab not found')
    })

    it('should return 400 for closed tab', async () => {
      mockDb.query.tabs.findFirst.mockResolvedValue({
        ...mockTab,
        status: 'paid',
        paidAmount: '100.00' // Make balance = 0 to trigger "already paid" error
      })

      const request = new NextRequest('http://localhost/api/v1/payments', {
        method: 'POST',
        headers: {
          'X-API-Key': 'tab_test_12345678901234567890123456789012',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tabId: '550e8400-e29b-41d4-a716-446655440000',
          amount: 100.00,
          metadata: {}
        })
      })

      await expect(POST(request)).rejects.toThrow('Tab is already paid')
    })

    it('should return 400 for tab with zero amount', async () => {
      mockDb.query.tabs.findFirst.mockResolvedValue({
        ...mockTab,
        totalAmount: '0.00',  // Use string format like other amount fields
        paidAmount: '0.00'
      })
      mockDb.query.lineItems.findMany.mockResolvedValue([])

      const request = new NextRequest('http://localhost/api/v1/payments', {
        method: 'POST',
        headers: {
          'X-API-Key': 'tab_test_12345678901234567890123456789012',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tabId: '550e8400-e29b-41d4-a716-446655440000',
          amount: 100.00,
          metadata: {}
        })
      })

      // The route checks balance = totalAmount - paidAmount
      // With both at 0, balance = 0, triggering "Tab is already paid" error
      await expect(POST(request)).rejects.toThrow('Tab is already paid')
    })

    it('should handle Stripe API errors', async () => {
      mockDb.query.tabs.findFirst.mockResolvedValue(mockTab)
      mockDb.query.merchants.findFirst.mockResolvedValue(mockMerchant)
      mockDb.query.lineItems.findMany.mockResolvedValue(mockLineItems)
      
      // Mock the MerchantProcessorService to throw an error
      const { MerchantProcessorService } = require('@/lib/services/merchant-processor.service')
      MerchantProcessorService.createProcessorInstance = jest.fn().mockRejectedValue(
        new Error('Your card was declined.')
      )

      const request = new NextRequest('http://localhost/api/v1/payments', {
        method: 'POST',
        headers: {
          'X-API-Key': 'tab_test_12345678901234567890123456789012',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tabId: '550e8400-e29b-41d4-a716-446655440000',
          amount: 100.00,
          metadata: {}
        })
      })

      // Should throw a DatabaseError which wraps the processor error
      await expect(POST(request)).rejects.toThrow('Database operation failed')
    })

    it('should validate request body', async () => {
      const request = new NextRequest('http://localhost/api/v1/payments', {
        method: 'POST',
        headers: {
          'X-API-Key': 'tab_test_12345678901234567890123456789012',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Missing tabId and amount
        })
      })

      // Should throw a ValidationError for missing fields
      await expect(POST(request)).rejects.toThrow('Invalid request data')
    })

    it('should require valid API key', async () => {
      const request = new NextRequest('http://localhost/api/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
          // Missing X-API-Key header
        },
        body: JSON.stringify({
          tabId: '550e8400-e29b-41d4-a716-446655440000',
          amount: 100.00,
          metadata: {}
        })
      })

      // The organization middleware will handle authentication and throw an error
      await expect(POST(request)).rejects.toThrow()
    })

    it('should handle merchant without Stripe account', async () => {
      mockDb.query.tabs.findFirst.mockResolvedValue(mockTab)
      mockDb.query.lineItems.findMany.mockResolvedValue(mockLineItems)

      // Mock MerchantProcessorService to throw NotFoundError (no processor configured)
      const { MerchantProcessorService } = require('@/lib/services/merchant-processor.service')
      MerchantProcessorService.createProcessorInstance = jest.fn().mockRejectedValue(
        new Error('Payment processor configuration not found: stripe')
      )

      const request = new NextRequest('http://localhost/api/v1/payments', {
        method: 'POST',
        headers: {
          'X-API-Key': 'tab_test_12345678901234567890123456789012',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tabId: '550e8400-e29b-41d4-a716-446655440000',
          amount: 100.00,
          metadata: {}
        })
      })

      // Should throw error when processor is not configured
      await expect(POST(request)).rejects.toThrow('Database operation failed')
    })

    it('should handle different currencies', async () => {
      const eurTab = { ...mockTab, currency: 'EUR' }
      mockDb.query.tabs.findFirst.mockResolvedValue(eurTab)
      mockDb.query.lineItems.findMany.mockResolvedValue(mockLineItems)
      
      // Reset MerchantProcessorService to working state
      const { MerchantProcessorService } = require('@/lib/services/merchant-processor.service')
      MerchantProcessorService.createProcessorInstance = jest.fn(() => Promise.resolve({
        createPaymentIntent: jest.fn().mockResolvedValue({
          processorPaymentId: 'pi_test123',
          clientSecret: 'pi_test123_secret_abc',
          amount: 10000,
          currency: 'eur',
          status: 'requires_payment_method'
        })
      }))

      const request = new NextRequest('http://localhost/api/v1/payments', {
        method: 'POST',
        headers: {
          'X-API-Key': 'tab_test_12345678901234567890123456789012',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tabId: '550e8400-e29b-41d4-a716-446655440000',
          amount: 100.00,
          metadata: {}
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data.paymentIntent.currency).toBe('eur')
    })
  })
})