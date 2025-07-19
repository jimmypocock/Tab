import { vi } from '@jest/globals'

// Mock Stripe Checkout Session
export const mockCheckoutSession = {
  id: 'cs_test_123',
  object: 'checkout.session',
  amount_total: 10000,
  currency: 'usd',
  customer_email: 'test@example.com',
  mode: 'payment',
  payment_status: 'paid',
  status: 'complete',
  success_url: 'https://example.com/pay/tab_123/success',
  cancel_url: 'https://example.com/pay/tab_123',
  metadata: {
    tab_id: 'tab_123',
    merchant_id: 'merchant_123',
  },
  payment_intent: 'pi_test_123',
  url: 'https://checkout.stripe.com/test_123',
}

// Mock Payment Intent
export const mockPaymentIntent = {
  id: 'pi_test_123',
  object: 'payment_intent',
  amount: 10000,
  currency: 'usd',
  status: 'succeeded',
  charges: {
    data: [{
      id: 'ch_test_123',
      amount: 10000,
      receipt_email: 'test@example.com',
      receipt_url: 'https://stripe.com/receipts/test_123',
    }],
  },
  metadata: {
    tab_id: 'tab_123',
    merchant_id: 'merchant_123',
  },
}

// Mock Stripe instance for server-side usage
export const createStripeMock = () => {
  return {
    checkout: {
      sessions: {
        create: jest.fn(() => Promise.resolve(mockCheckoutSession)),
        retrieve: jest.fn(() => Promise.resolve(mockCheckoutSession)),
        list: jest.fn(() => Promise.resolve({ data: [mockCheckoutSession] })),
      },
    },
    paymentIntents: {
      create: jest.fn(() => Promise.resolve(mockPaymentIntent)),
      retrieve: jest.fn(() => Promise.resolve(mockPaymentIntent)),
      update: jest.fn(() => Promise.resolve(mockPaymentIntent)),
      confirm: jest.fn(() => Promise.resolve(mockPaymentIntent)),
      cancel: jest.fn(() => Promise.resolve({ ...mockPaymentIntent, status: 'canceled' })),
    },
    charges: {
      retrieve: jest.fn(() => Promise.resolve(mockPaymentIntent.charges.data[0])),
    },
    refunds: {
      create: jest.fn(() => Promise.resolve({
        id: 'refund_test_123',
        amount: 5000,
        charge: 'ch_test_123',
        status: 'succeeded',
      })),
    },
    webhookEndpoints: {
      create: jest.fn(),
      list: jest.fn(() => Promise.resolve({ data: [] })),
    },
    webhooks: {
      constructEvent: jest.fn((payload, signature, secret) => {
        // Return the parsed payload as the event
        return JSON.parse(payload)
      }),
    },
  }
}

// Mock the Stripe module
export const mockStripe = () => {
  const stripeMock = createStripeMock()
  
  jest.mock('stripe', () => {
    return jest.fn(() => stripeMock)
  })
  
  return stripeMock
}

// Helper to create custom checkout session
export const createCheckoutSession = (overrides = {}) => ({
  ...mockCheckoutSession,
  ...overrides,
})

// Helper to create custom payment intent
export const createPaymentIntent = (overrides = {}) => ({
  ...mockPaymentIntent,
  ...overrides,
})

// Mock for testing checkout flow
export const mockCheckoutFlow = {
  // Mock window.location for redirect
  mockRedirect: (url: string) => {
    delete (window as any).location
    window.location = {
      href: url,
      origin: 'http://localhost',
      protocol: 'http:',
      host: 'localhost',
      hostname: 'localhost',
      port: '',
      pathname: '/',
      search: '',
      hash: '',
      toString: () => url,
      assign: jest.fn(),
      replace: jest.fn(),
      reload: jest.fn(),
    } as any
  },
  
  // Restore window.location
  restoreLocation: () => {
    delete (window as any).location
    window.location = window.location
  },
  
  // Simulate successful checkout completion
  completeCheckout: async (sessionId: string) => {
    return {
      session: createCheckoutSession({
        id: sessionId,
        payment_status: 'paid',
        status: 'complete',
      }),
      paymentIntent: createPaymentIntent({
        status: 'succeeded',
      }),
    }
  },
  
  // Simulate failed checkout
  failCheckout: async (sessionId: string, reason = 'card_declined') => {
    return {
      session: createCheckoutSession({
        id: sessionId,
        payment_status: 'unpaid',
        status: 'open',
      }),
      error: {
        type: 'card_error',
        code: reason,
        message: 'Your card was declined',
      },
    }
  },
}