/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { PaymentSuccessCard } from '@/components/payment'

describe('PaymentSuccessCard', () => {
  const defaultProps = {
    merchantName: 'Test Business',
    paymentId: 'pay_123',
    amount: 5000,
    total: 10000,
    status: 'partial' as const
  }

  it('renders payment success information', () => {
    render(<PaymentSuccessCard {...defaultProps} />)
    
    expect(screen.getByText('Payment Successful')).toBeInTheDocument()
    expect(screen.getByText('Transaction #pay_123')).toBeInTheDocument()
    expect(screen.getByText('Test Business')).toBeInTheDocument()
  })

  it('displays payment date', () => {
    const paymentDate = new Date('2024-01-15T10:30:00')
    render(<PaymentSuccessCard {...defaultProps} paymentDate={paymentDate} />)
    
    // Check that date is formatted (exact format may vary by locale)
    expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument()
  })

  it('shows customer email when provided', () => {
    render(<PaymentSuccessCard {...defaultProps} customerEmail="customer@example.com" />)
    
    expect(screen.getByText(/Receipt sent to:/)).toBeInTheDocument()
    expect(screen.getByText('customer@example.com')).toBeInTheDocument()
  })

  it('renders action buttons when handlers provided', () => {
    const onPrint = jest.fn()
    const onDownload = jest.fn()
    const onResendEmail = jest.fn()
    
    render(
      <PaymentSuccessCard
        {...defaultProps}
        customerEmail="customer@example.com"
        onPrint={onPrint}
        onDownload={onDownload}
        onResendEmail={onResendEmail}
      />
    )
    
    const printButton = screen.getByRole('button', { name: /print/i })
    const downloadButton = screen.getByRole('button', { name: /download/i })
    const resendButton = screen.getByRole('button', { name: /resend/i })
    
    fireEvent.click(printButton)
    fireEvent.click(downloadButton)
    fireEvent.click(resendButton)
    
    expect(onPrint).toHaveBeenCalledTimes(1)
    expect(onDownload).toHaveBeenCalledTimes(1)
    expect(onResendEmail).toHaveBeenCalledTimes(1)
  })

  it('does not show resend button without email', () => {
    render(
      <PaymentSuccessCard
        {...defaultProps}
        onResendEmail={jest.fn()}
      />
    )
    
    expect(screen.queryByRole('button', { name: /resend/i })).not.toBeInTheDocument()
  })

  it('shows balance for partial payments', () => {
    render(<PaymentSuccessCard {...defaultProps} status="partial" />)
    
    // PaymentAmountDisplay should show balance
    expect(screen.getByTestId('payment-balance')).toBeInTheDocument()
  })

  it('does not show balance for full payments', () => {
    render(<PaymentSuccessCard {...defaultProps} status="paid" amount={10000} />)
    
    expect(screen.queryByTestId('payment-balance')).not.toBeInTheDocument()
  })

  it('displays correct payment status badge', () => {
    const { rerender } = render(<PaymentSuccessCard {...defaultProps} status="paid" />)
    expect(screen.getByTestId('payment-status-paid')).toBeInTheDocument()
    
    rerender(<PaymentSuccessCard {...defaultProps} status="partial" />)
    expect(screen.getByTestId('payment-status-partial')).toBeInTheDocument()
    
    rerender(<PaymentSuccessCard {...defaultProps} status="failed" />)
    expect(screen.getByTestId('payment-status-failed')).toBeInTheDocument()
  })

  it('accepts custom className', () => {
    const { container } = render(
      <PaymentSuccessCard {...defaultProps} className="custom-class" />
    )
    
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('handles string amounts', () => {
    render(
      <PaymentSuccessCard
        {...defaultProps}
        amount="50.00"
        total="100.00"
      />
    )
    
    expect(screen.getByTestId('payment-total')).toHaveTextContent('$100.00')
    expect(screen.getByTestId('payment-paid')).toHaveTextContent('$50.00')
  })
})