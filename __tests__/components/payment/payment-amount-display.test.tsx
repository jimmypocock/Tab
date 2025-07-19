/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { PaymentAmountDisplay } from '@/components/payment'

describe('PaymentAmountDisplay', () => {
  it('renders amounts correctly', () => {
    render(<PaymentAmountDisplay total={100} paid={25} />)
    
    expect(screen.getByTestId('payment-total')).toHaveTextContent('$100.00')
    expect(screen.getByTestId('payment-paid')).toHaveTextContent('$25.00')
    expect(screen.getByTestId('payment-balance')).toHaveTextContent('$75.00')
  })

  it('handles string amounts', () => {
    render(<PaymentAmountDisplay total="150.50" paid="50.00" />)
    
    expect(screen.getByTestId('payment-total')).toHaveTextContent('$150.50')
    expect(screen.getByTestId('payment-paid')).toHaveTextContent('$50.00')
    expect(screen.getByTestId('payment-balance')).toHaveTextContent('$100.50')
  })

  it('formats different currencies', () => {
    render(<PaymentAmountDisplay total={100} paid={25} currency="EUR" />)
    
    // Note: The exact format might vary based on locale
    expect(screen.getByTestId('payment-total')).toHaveTextContent('100')
    expect(screen.getByTestId('payment-total')).toHaveTextContent('€')
  })

  it('shows green color when fully paid', () => {
    render(<PaymentAmountDisplay total={100} paid={100} />)
    
    const paidElement = screen.getByTestId('payment-paid')
    expect(paidElement).toHaveClass('text-green-600')
    
    // Balance should not be shown when fully paid
    expect(screen.queryByTestId('payment-balance')).not.toBeInTheDocument()
  })

  it('shows blue color when partially paid', () => {
    render(<PaymentAmountDisplay total={100} paid={50} />)
    
    const paidElement = screen.getByTestId('payment-paid')
    expect(paidElement).toHaveClass('text-blue-600')
  })

  it('hides balance when showBalance is false', () => {
    render(<PaymentAmountDisplay total={100} paid={25} showBalance={false} />)
    
    expect(screen.getByTestId('payment-total')).toBeInTheDocument()
    expect(screen.getByTestId('payment-paid')).toBeInTheDocument()
    expect(screen.queryByTestId('payment-balance')).not.toBeInTheDocument()
  })

  it('handles overpayment correctly', () => {
    render(<PaymentAmountDisplay total={100} paid={150} />)
    
    // Should not show negative balance
    expect(screen.queryByTestId('payment-balance')).not.toBeInTheDocument()
  })

  it('accepts custom className', () => {
    const { container } = render(
      <PaymentAmountDisplay total={100} paid={25} className="custom-class" />
    )
    
    const wrapper = container.firstChild
    expect(wrapper).toHaveClass('custom-class')
  })
})