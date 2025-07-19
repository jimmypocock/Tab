/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { PaymentReceipt } from '@/components/payment'

describe('PaymentReceipt', () => {
  const defaultProps = {
    merchantName: 'Test Business Inc.',
    paymentId: 'pay_abc123',
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    paymentDate: new Date('2024-01-15T10:00:00'),
    subtotal: 10000,
    total: 10000,
    amountPaid: 10000,
    status: 'paid' as const
  }

  it('renders receipt header information', () => {
    render(<PaymentReceipt {...defaultProps} />)
    
    expect(screen.getByText('Payment Receipt')).toBeInTheDocument()
    expect(screen.getByText('Test Business Inc.')).toBeInTheDocument()
    expect(screen.getByText('Receipt #pay_abc123')).toBeInTheDocument()
    expect(screen.getByText('January 15, 2024')).toBeInTheDocument()
  })

  it('displays merchant address when provided', () => {
    render(
      <PaymentReceipt
        {...defaultProps}
        merchantAddress="123 Main St\nSuite 100\nAnytown, ST 12345"
      />
    )
    
    expect(screen.getByText(/123 Main St/)).toBeInTheDocument()
  })

  it('shows invoice number when provided', () => {
    render(<PaymentReceipt {...defaultProps} invoiceNumber="INV-2024-001" />)
    
    expect(screen.getByText('Invoice #INV-2024-001')).toBeInTheDocument()
  })

  it('displays customer information', () => {
    render(<PaymentReceipt {...defaultProps} />)
    
    expect(screen.getByText('Bill To:')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('john@example.com')).toBeInTheDocument()
  })

  it('renders line items table', () => {
    const lineItems = [
      { description: 'Service A', quantity: 2, amount: 5000 },
      { description: 'Service B', quantity: 1, amount: 5000 }
    ]
    
    render(<PaymentReceipt {...defaultProps} lineItems={lineItems} />)
    
    expect(screen.getByText('Service A')).toBeInTheDocument()
    expect(screen.getByText('Service B')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    // Both line items have the same amount, so we should find multiple
    const fiftyDollarAmounts = screen.getAllByText('$50.00')
    expect(fiftyDollarAmounts).toHaveLength(2)
  })

  it('displays totals correctly', () => {
    render(
      <PaymentReceipt
        {...defaultProps}
        subtotal={9000}
        tax={1000}
        total={10000}
      />
    )
    
    expect(screen.getByText('Subtotal')).toBeInTheDocument()
    expect(screen.getByText('$90.00')).toBeInTheDocument()
    expect(screen.getByText('Tax')).toBeInTheDocument()
    expect(screen.getByText('$10.00')).toBeInTheDocument()
    expect(screen.getByText('Total')).toBeInTheDocument()
    // Multiple $100.00 values exist (total and amount paid), so use getAllByText
    const hundredDollarAmounts = screen.getAllByText('$100.00')
    expect(hundredDollarAmounts.length).toBeGreaterThan(0)
  })

  it('shows payment method', () => {
    render(<PaymentReceipt {...defaultProps} paymentMethod="Visa ending in 4242" />)
    
    expect(screen.getByText('Payment Method')).toBeInTheDocument()
    expect(screen.getByText('Visa ending in 4242')).toBeInTheDocument()
  })

  it('displays balance due for partial payments', () => {
    render(
      <PaymentReceipt
        {...defaultProps}
        status="partial"
        total={10000}
        amountPaid={6000}
      />
    )
    
    expect(screen.getByText('Balance Due')).toBeInTheDocument()
    expect(screen.getByText('$40.00')).toBeInTheDocument()
  })

  it('shows notes when provided', () => {
    render(
      <PaymentReceipt
        {...defaultProps}
        notes="Thank you for your business! Please contact us with any questions."
      />
    )
    
    expect(screen.getByText('Notes')).toBeInTheDocument()
    expect(screen.getByText(/Thank you for your business/)).toBeInTheDocument()
  })

  it('renders footer text', () => {
    render(<PaymentReceipt {...defaultProps} />)
    
    expect(screen.getByText('Thank you for your payment!')).toBeInTheDocument()
    expect(screen.getByText(/valid without a signature/)).toBeInTheDocument()
  })

  it('accepts custom className', () => {
    render(<PaymentReceipt {...defaultProps} className="print:hidden" />)
    
    const receipt = screen.getByTestId('payment-receipt')
    expect(receipt).toHaveClass('print:hidden')
  })

  it('handles no line items gracefully', () => {
    render(<PaymentReceipt {...defaultProps} lineItems={[]} />)
    
    // Should not show table headers when no items
    expect(screen.queryByText('Description')).not.toBeInTheDocument()
  })

  it('does not show tax line when tax is 0', () => {
    render(<PaymentReceipt {...defaultProps} tax={0} />)
    
    expect(screen.queryByText('Tax')).not.toBeInTheDocument()
  })
})