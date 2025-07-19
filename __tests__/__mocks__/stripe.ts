import { createStripeMock } from '../helpers/stripe-checkout-mock'

// Create default mock instance
const defaultStripeMock = createStripeMock()

// Export a constructor function that returns our mock
const Stripe = jest.fn(() => defaultStripeMock)

// Add static methods that might be used
Stripe.errors = {
  StripeError: class StripeError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'StripeError'
    }
  },
  StripeCardError: class StripeCardError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'StripeCardError'
    }
  },
  StripeInvalidRequestError: class StripeInvalidRequestError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'StripeInvalidRequestError'
    }
  },
}

export default Stripe

// Helper to update the mock for specific tests
export const updateStripeMock = (newMock: any) => {
  Stripe.mockReturnValue(newMock)
}

// Reset to default mock
export const resetStripeMock = () => {
  Stripe.mockReturnValue(defaultStripeMock)
}