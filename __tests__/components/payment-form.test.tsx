/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PaymentForm } from '@/components/ui/payment-form'
import { Elements } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'

// Mock Stripe
jest.mock('@stripe/stripe-js', () => ({
  loadStripe: jest.fn(() => Promise.resolve({
    elements: jest.fn(),
    createPaymentMethod: jest.fn(),
    confirmPayment: jest.fn(),
  })),
}))

// Mock fetch for API calls
global.fetch = jest.fn()

const mockStripePromise = loadStripe('pk_test_mock')

describe('PaymentForm Component', () => {
  const mockTab = {
    id: 'tab_123',
    total: '100.00',
    paidAmount: '0.00',
    balanceDue: '100.00',
    currency: 'USD',
    status: 'open'
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
  })

  it('renders payment form with tab details', () => {
    render(
      <Elements stripe={mockStripePromise}>
        <PaymentForm tab={mockTab} />
      </Elements>
    )

    expect(screen.getByText('Balance Due')).toBeInTheDocument()
    expect(screen.getByText('$100.00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pay/i })).toBeInTheDocument()
  })

  it('allows entering custom payment amount', async () => {
    const user = userEvent.setup()
    
    render(
      <Elements stripe={mockStripePromise}>
        <PaymentForm tab={mockTab} />
      </Elements>
    )

    // Find and click the custom amount option
    const customAmountRadio = screen.getByLabelText(/other amount/i)
    await user.click(customAmountRadio)

    // Enter custom amount
    const amountInput = screen.getByPlaceholderText(/enter amount/i)
    await user.clear(amountInput)
    await user.type(amountInput, '50.00')

    expect(amountInput).toHaveValue('50.00')
  })

  it('validates payment amount', async () => {
    const user = userEvent.setup()
    
    render(
      <Elements stripe={mockStripePromise}>
        <PaymentForm tab={mockTab} />
      </Elements>
    )

    // Select custom amount
    const customAmountRadio = screen.getByLabelText(/other amount/i)
    await user.click(customAmountRadio)

    // Enter amount exceeding balance
    const amountInput = screen.getByPlaceholderText(/enter amount/i)
    await user.clear(amountInput)
    await user.type(amountInput, '150.00')

    // Try to submit
    const payButton = screen.getByRole('button', { name: /pay/i })
    await user.click(payButton)

    // Should show error
    await waitFor(() => {
      expect(screen.getByText(/exceeds balance due/i)).toBeInTheDocument()
    })
  })

  it('handles successful payment submission', async () => {
    const user = userEvent.setup()
    const onSuccess = jest.fn()
    
    // Mock successful payment intent creation
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          clientSecret: 'pi_test_secret',
          amount: '100.00',
          currency: 'USD'
        }
      })
    })

    render(
      <Elements stripe={mockStripePromise}>
        <PaymentForm tab={mockTab} onSuccess={onSuccess} />
      </Elements>
    )

    // Fill in card details (mocked by Stripe Elements)
    // In real test, you'd use Stripe's test card element

    // Submit payment
    const payButton = screen.getByRole('button', { name: /pay \$100\.00/i })
    await user.click(payButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/public/public-intent',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            tabId: 'tab_123',
            amount: '100.00'
          })
        })
      )
    })
  })

  it('displays error message on payment failure', async () => {
    const user = userEvent.setup()
    
    // Mock failed API call
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'Payment failed. Please try again.'
      })
    })

    render(
      <Elements stripe={mockStripePromise}>
        <PaymentForm tab={mockTab} />
      </Elements>
    )

    const payButton = screen.getByRole('button', { name: /pay/i })
    await user.click(payButton)

    await waitFor(() => {
      expect(screen.getByText(/payment failed/i)).toBeInTheDocument()
    })
  })

  it('disables form during payment processing', async () => {
    const user = userEvent.setup()
    
    // Mock slow API call
    ;(global.fetch as jest.Mock).mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 1000))
    )

    render(
      <Elements stripe={mockStripePromise}>
        <PaymentForm tab={mockTab} />
      </Elements>
    )

    const payButton = screen.getByRole('button', { name: /pay/i })
    await user.click(payButton)

    // Button should be disabled and show loading state
    expect(payButton).toBeDisabled()
    expect(screen.getByText(/processing/i)).toBeInTheDocument()
  })

  it('handles partial payment correctly', async () => {
    const user = userEvent.setup()
    const partialTab = {
      ...mockTab,
      paidAmount: '60.00',
      balanceDue: '40.00',
      status: 'partial'
    }
    
    render(
      <Elements stripe={mockStripePromise}>
        <PaymentForm tab={partialTab} />
      </Elements>
    )

    expect(screen.getByText('Balance Due')).toBeInTheDocument()
    expect(screen.getByText('$40.00')).toBeInTheDocument()
    expect(screen.getByText(/\$60\.00 paid/i)).toBeInTheDocument()
  })

  it('shows correct state for paid tab', () => {
    const paidTab = {
      ...mockTab,
      paidAmount: '100.00',
      balanceDue: '0.00',
      status: 'paid'
    }
    
    render(
      <Elements stripe={mockStripePromise}>
        <PaymentForm tab={paidTab} />
      </Elements>
    )

    expect(screen.getByText(/fully paid/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pay/i })).not.toBeInTheDocument()
  })
})