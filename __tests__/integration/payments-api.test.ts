/**
 * Payments API Integration Tests
 * 
 * Tests all payment-related endpoints with real business logic
 * and proper error handling scenarios.
 */

import { NextRequest } from 'next/server'
import {
  TEST_CONFIG,
  createTestRequest,
  TestData,
  ApiTestHelpers
} from './api-test-setup'

// Set test environment
process.env.NODE_ENV = 'test'
process.env.NEXT_PUBLIC_SUPABASE_URL = TEST_CONFIG.SUPABASE_URL
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = TEST_CONFIG.SUPABASE_ANON_KEY
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
process.env.STRIPE_SECRET_KEY = TEST_CONFIG.STRIPE_SECRET_KEY
process.env.RESEND_API_KEY = TEST_CONFIG.RESEND_API_KEY

// Mock external dependencies
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: TEST_CONFIG.TEST_USER_ID } }
      })
    }
  }))
}))

const mockStripe = {
  checkout: {
    sessions: {
      create: jest.fn(),
      retrieve: jest.fn()
    }
  },
  paymentIntents: {
    create: jest.fn(),
    retrieve: jest.fn(),
    confirm: jest.fn()
  }
}

jest.mock('@/lib/stripe/client', () => ({
  stripe: mockStripe
}))

jest.mock('@/lib/redis/client', () => ({
  redis: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    hget: jest.fn().mockResolvedValue(null),
    hset: jest.fn().mockResolvedValue(1),
  }
}))

// Mock the database
const mockDb = {
  query: {
    payments: {
      findMany: jest.fn(),
      findFirst: jest.fn()
    },
    tabs: {
      findFirst: jest.fn()
    },
    lineItems: {
      findMany: jest.fn()
    },
    organizations: {
      findFirst: jest.fn().mockResolvedValue({
        id: TEST_CONFIG.TEST_ORGANIZATION_ID,
        name: 'Test Organization',
        isMerchant: true,
        isCorporate: false
      })
    },
    apiKeys: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'key-123',
        organizationId: TEST_CONFIG.TEST_ORGANIZATION_ID,
        hashedKey: 'hashed-key',
        isActive: true
      })
    }
  },
  insert: jest.fn(() => ({
    values: jest.fn(() => ({
      returning: jest.fn()
    }))
  })),
  update: jest.fn(() => ({
    set: jest.fn(() => ({
      where: jest.fn(() => ({
        returning: jest.fn()
      }))
    }))
  })),
  select: jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        execute: jest.fn()
      }))
    }))
  })),
  transaction: jest.fn()
}

jest.mock('@/lib/db/client', () => ({
  db: mockDb
}))

// Mock organization middleware
jest.mock('@/lib/api/organization-middleware', () => ({
  withOrganizationAuth: jest.fn((handler) => {
    return async (request: NextRequest, context?: any) => {
      const mockContext = {
        organizationId: TEST_CONFIG.TEST_ORGANIZATION_ID,
        organization: {
          id: TEST_CONFIG.TEST_ORGANIZATION_ID,
          name: 'Test Organization',
          isMerchant: true,
          isCorporate: false
        },
        userId: TEST_CONFIG.TEST_USER_ID,
        userRole: 'owner',
        apiKey: TEST_CONFIG.TEST_API_KEY,
        authType: 'apiKey' as const,
        scope: 'merchant' as const
      }
      
      return handler(request, mockContext)
    }
  })
}))

describe('Payments API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Set up default mock responses
    mockDb.query.payments.findMany.mockResolvedValue([])
    mockDb.query.payments.findFirst.mockResolvedValue(null)
    mockDb.query.tabs.findFirst.mockResolvedValue(TestData.tab())
    mockDb.insert().values().returning.mockResolvedValue([TestData.payment()])
    mockDb.select().from().where().execute.mockResolvedValue([{ count: '0' }])
    
    // Reset Stripe mocks
    mockStripe.paymentIntents.create.mockResolvedValue({
      id: 'pi_test_123',
      client_secret: 'pi_test_123_secret_123',
      status: 'requires_payment_method',
      amount: 10000,
      currency: 'usd'
    })
    
    mockStripe.checkout.sessions.create.mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/test',
      payment_status: 'unpaid'
    })
  })

  describe('GET /api/v1/payments', () => {
    it('should return empty list when no payments exist', async () => {
      const { GET } = await import('@/app/api/v1/payments/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/payments')
      const response = await GET(request)
      
      ApiTestHelpers.expectSuccessResponse(response, 200)
      
      const data = await ApiTestHelpers.expectPaginatedResponse(response)
      expect(data.data).toHaveLength(0)
      expect(data.pagination.totalItems).toBe(0)
    })

    it('should return payments list when payments exist', async () => {
      const testPayments = [
        TestData.payment({ id: 'pay_test_1', amount: '50.00' }),
        TestData.payment({ id: 'pay_test_2', amount: '75.00', status: 'pending' })
      ]
      
      mockDb.query.payments.findMany.mockResolvedValue(testPayments)
      mockDb.select().from().where().execute.mockResolvedValue([{ count: '2' }])
      
      const { GET } = await import('@/app/api/v1/payments/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/payments')
      const response = await GET(request)
      
      ApiTestHelpers.expectSuccessResponse(response, 200)
      
      const data = await ApiTestHelpers.expectPaginatedResponse(response)
      expect(data.data).toHaveLength(2)
      expect(data.data[0].amount).toBe('50.00')
      expect(data.data[1].status).toBe('pending')
      expect(data.pagination.totalItems).toBe(2)
    })

    it('should filter payments by status', async () => {
      const succeededPayments = [
        TestData.payment({ id: 'pay_succeeded_1', status: 'succeeded' }),
        TestData.payment({ id: 'pay_succeeded_2', status: 'succeeded' })
      ]
      
      mockDb.query.payments.findMany.mockResolvedValue(succeededPayments)
      
      const { GET } = await import('@/app/api/v1/payments/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/payments', {
        params: { status: 'succeeded' }
      })
      
      const response = await GET(request)
      
      ApiTestHelpers.expectSuccessResponse(response, 200)
      
      const data = await response.json()
      expect(data.data).toHaveLength(2)
      data.data.forEach((payment: any) => {
        expect(payment.status).toBe('succeeded')
      })
    })

    it('should filter payments by tab ID', async () => {
      const tabPayments = [
        TestData.payment({ id: 'pay_tab_1', tabId: 'specific_tab_123' })
      ]
      
      mockDb.query.payments.findMany.mockResolvedValue(tabPayments)
      
      const { GET } = await import('@/app/api/v1/payments/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/payments', {
        params: { tabId: 'specific_tab_123' }
      })
      
      const response = await GET(request)
      
      ApiTestHelpers.expectSuccessResponse(response, 200)
      
      const data = await response.json()
      expect(data.data).toHaveLength(1)
      expect(data.data[0].tabId).toBe('specific_tab_123')
    })
  })

  describe('POST /api/v1/payments (Create Payment Intent)', () => {
    it('should create payment intent successfully', async () => {
      const paymentPayload = {
        tabId: 'tab_test_123',
        amount: 10000, // $100.00 in cents
        paymentMethodId: 'pm_test_123'
      }
      
      const testTab = TestData.tab({
        id: 'tab_test_123',
        totalAmount: '100.00',
        paidAmount: '0.00',
        status: 'open'
      })
      
      mockDb.query.tabs.findFirst.mockResolvedValue(testTab)
      
      const { POST } = await import('@/app/api/v1/payments/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/payments', {
        method: 'POST',
        body: JSON.stringify(paymentPayload)
      })
      
      const response = await POST(request)
      
      ApiTestHelpers.expectSuccessResponse(response, 201)
      
      const data = await ApiTestHelpers.expectResponseData(response, [
        'id', 'client_secret', 'status', 'amount'
      ])
      
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 10000,
          currency: 'usd',
          payment_method: 'pm_test_123',
          metadata: expect.objectContaining({
            tabId: 'tab_test_123',
            organizationId: TEST_CONFIG.TEST_ORGANIZATION_ID
          })
        })
      )
    })

    it('should create payment intent for full tab amount when amount not specified', async () => {
      const paymentPayload = {
        tabId: 'tab_test_123'
        // No amount specified - should use full tab amount
      }
      
      const testTab = TestData.tab({
        id: 'tab_test_123',
        totalAmount: '150.00',
        paidAmount: '50.00', // Already paid $50
        status: 'open'
      })
      
      mockDb.query.tabs.findFirst.mockResolvedValue(testTab)
      
      const { POST } = await import('@/app/api/v1/payments/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/payments', {
        method: 'POST',
        body: JSON.stringify(paymentPayload)
      })
      
      const response = await POST(request)
      
      ApiTestHelpers.expectSuccessResponse(response, 201)
      
      // Should create payment intent for remaining balance ($100.00)
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 10000, // $100.00 in cents (150.00 - 50.00)
          currency: 'usd'
        })
      )
    })

    it('should reject payment for non-existent tab', async () => {
      mockDb.query.tabs.findFirst.mockResolvedValue(null)
      
      const paymentPayload = {
        tabId: 'nonexistent_tab',
        amount: 5000
      }
      
      const { POST } = await import('@/app/api/v1/payments/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/payments', {
        method: 'POST',
        body: JSON.stringify(paymentPayload)
      })
      
      const response = await POST(request)
      
      ApiTestHelpers.expectErrorResponse(response, 404)
      
      const data = await response.json()
      expect(data.error).toContain('Tab not found')
    })

    it('should reject payment for closed tab', async () => {
      const closedTab = TestData.tab({
        id: 'tab_closed_123',
        status: 'closed'
      })
      
      mockDb.query.tabs.findFirst.mockResolvedValue(closedTab)
      
      const paymentPayload = {
        tabId: 'tab_closed_123',
        amount: 5000
      }
      
      const { POST } = await import('@/app/api/v1/payments/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/payments', {
        method: 'POST',
        body: JSON.stringify(paymentPayload)
      })
      
      const response = await POST(request)
      
      ApiTestHelpers.expectErrorResponse(response, 400)
      
      const data = await response.json()
      expect(data.error).toContain('Cannot process payment for closed tab')
    })

    it('should reject overpayment', async () => {
      const testTab = TestData.tab({
        id: 'tab_test_123',
        totalAmount: '100.00',
        paidAmount: '80.00', // Only $20 remaining
        status: 'open'
      })
      
      mockDb.query.tabs.findFirst.mockResolvedValue(testTab)
      
      const paymentPayload = {
        tabId: 'tab_test_123',
        amount: 3000 // $30.00 - more than remaining $20.00
      }
      
      const { POST } = await import('@/app/api/v1/payments/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/payments', {
        method: 'POST',
        body: JSON.stringify(paymentPayload)
      })
      
      const response = await POST(request)
      
      ApiTestHelpers.expectErrorResponse(response, 400)
      
      const data = await response.json()
      expect(data.error).toContain('Payment amount exceeds remaining balance')
    })

    it('should handle validation errors', async () => {
      const invalidPayload = {
        tabId: '', // Invalid - empty tab ID
        amount: -1000 // Invalid - negative amount
      }
      
      const { POST } = await import('@/app/api/v1/payments/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/payments', {
        method: 'POST',
        body: JSON.stringify(invalidPayload)
      })
      
      const response = await POST(request)
      
      ApiTestHelpers.expectErrorResponse(response, 400)
      
      const data = await response.json()
      expect(data.error).toContain('Invalid request data')
      expect(data.details).toBeDefined()
    })
  })

  describe('POST /api/v1/payments/checkout (Create Checkout Session)', () => {
    it('should create Stripe checkout session', async () => {
      const checkoutPayload = {
        tabId: 'tab_test_123',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel'
      }
      
      const testTab = TestData.tab({
        id: 'tab_test_123',
        totalAmount: '100.00',
        lineItems: [
          TestData.lineItem({ description: 'Test Item', totalPrice: '100.00' })
        ]
      })
      
      mockDb.query.tabs.findFirst.mockResolvedValue(testTab)
      
      const { POST } = await import('@/app/api/v1/payments/checkout/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/payments/checkout', {
        method: 'POST',
        body: JSON.stringify(checkoutPayload)
      })
      
      const response = await POST(request)
      
      ApiTestHelpers.expectSuccessResponse(response, 201)
      
      const data = await ApiTestHelpers.expectResponseData(response, [
        'id', 'url'
      ])
      
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_method_types: ['card'],
          mode: 'payment',
          success_url: 'https://example.com/success',
          cancel_url: 'https://example.com/cancel',
          metadata: expect.objectContaining({
            tabId: 'tab_test_123',
            organizationId: TEST_CONFIG.TEST_ORGANIZATION_ID
          })
        })
      )
    })

    it('should include line items in checkout session', async () => {
      const testTab = TestData.tab({
        id: 'tab_test_123',
        lineItems: [
          TestData.lineItem({ 
            description: 'Premium Service', 
            quantity: 2, 
            unitPrice: '25.00',
            totalPrice: '50.00'
          }),
          TestData.lineItem({ 
            description: 'Setup Fee', 
            quantity: 1, 
            unitPrice: '50.00',
            totalPrice: '50.00'
          })
        ]
      })
      
      mockDb.query.tabs.findFirst.mockResolvedValue(testTab)
      
      const checkoutPayload = {
        tabId: 'tab_test_123',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel'
      }
      
      const { POST } = await import('@/app/api/v1/payments/checkout/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/payments/checkout', {
        method: 'POST',
        body: JSON.stringify(checkoutPayload)
      })
      
      const response = await POST(request)
      
      ApiTestHelpers.expectSuccessResponse(response, 201)
      
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: expect.arrayContaining([
            expect.objectContaining({
              price_data: expect.objectContaining({
                product_data: { name: 'Premium Service' },
                unit_amount: 2500 // $25.00 in cents
              }),
              quantity: 2
            }),
            expect.objectContaining({
              price_data: expect.objectContaining({
                product_data: { name: 'Setup Fee' },
                unit_amount: 5000 // $50.00 in cents
              }),
              quantity: 1
            })
          ])
        })
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle Stripe API errors', async () => {
      mockStripe.paymentIntents.create.mockRejectedValue(
        new Error('Your card was declined.')
      )
      
      const testTab = TestData.tab()
      mockDb.query.tabs.findFirst.mockResolvedValue(testTab)
      
      const paymentPayload = {
        tabId: 'tab_test_123',
        amount: 5000
      }
      
      const { POST } = await import('@/app/api/v1/payments/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/payments', {
        method: 'POST',
        body: JSON.stringify(paymentPayload)
      })
      
      const response = await POST(request)
      
      ApiTestHelpers.expectErrorResponse(response, 500)
      
      const data = await response.json()
      expect(data.error).toBeDefined()
    })

    it('should handle database errors', async () => {
      mockDb.query.tabs.findFirst.mockRejectedValue(
        new Error('Database connection failed')
      )
      
      const paymentPayload = {
        tabId: 'tab_test_123',
        amount: 5000
      }
      
      const { POST } = await import('@/app/api/v1/payments/route')
      
      const request = createTestRequest('http://localhost:3000/api/v1/payments', {
        method: 'POST',
        body: JSON.stringify(paymentPayload)
      })
      
      const response = await POST(request)
      
      ApiTestHelpers.expectErrorResponse(response, 500)
    })
  })

  describe('Business Logic Validation', () => {
    it('should track payment attempts and prevent duplicate processing', async () => {
      // Test idempotency key handling
      const paymentPayload = {
        tabId: 'tab_test_123',
        amount: 5000,
        idempotencyKey: 'unique-key-123'
      }
      
      const testTab = TestData.tab()
      mockDb.query.tabs.findFirst.mockResolvedValue(testTab)
      
      // First request should succeed
      const { POST } = await import('@/app/api/v1/payments/route')
      
      const request1 = createTestRequest('http://localhost:3000/api/v1/payments', {
        method: 'POST',
        body: JSON.stringify(paymentPayload),
        headers: {
          'Idempotency-Key': 'unique-key-123'
        }
      })
      
      const response1 = await POST(request1)
      ApiTestHelpers.expectSuccessResponse(response1, 201)
      
      // Second request with same idempotency key should handle gracefully
      const request2 = createTestRequest('http://localhost:3000/api/v1/payments', {
        method: 'POST',
        body: JSON.stringify(paymentPayload),
        headers: {
          'Idempotency-Key': 'unique-key-123'
        }
      })
      
      const response2 = await POST(request2)
      // Implementation detail - could be 201 (same result) or 409 (conflict)
      expect([201, 409]).toContain(response2.status)
    })
  })
})