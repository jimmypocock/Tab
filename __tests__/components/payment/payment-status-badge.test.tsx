/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { PaymentStatusBadge } from '@/components/payment'

describe('PaymentStatusBadge', () => {
  it('renders paid status correctly', () => {
    render(<PaymentStatusBadge status="paid" />)
    const badge = screen.getByTestId('payment-status-paid')
    expect(badge).toHaveTextContent('Paid')
    expect(badge).toHaveClass('bg-green-100') // success variant
  })

  it('renders partial status correctly', () => {
    render(<PaymentStatusBadge status="partial" />)
    const badge = screen.getByTestId('payment-status-partial')
    expect(badge).toHaveTextContent('Partial')
    expect(badge).toHaveClass('bg-yellow-100') // warning variant
  })

  it('renders open status correctly', () => {
    render(<PaymentStatusBadge status="open" />)
    const badge = screen.getByTestId('payment-status-open')
    expect(badge).toHaveTextContent('Open')
    expect(badge).toHaveClass('bg-gray-100') // default variant
  })

  it('renders disputed status correctly', () => {
    render(<PaymentStatusBadge status="disputed" />)
    const badge = screen.getByTestId('payment-status-disputed')
    expect(badge).toHaveTextContent('Disputed')
    expect(badge).toHaveClass('bg-red-100') // danger variant
  })

  it('renders refunded status correctly', () => {
    render(<PaymentStatusBadge status="refunded" />)
    const badge = screen.getByTestId('payment-status-refunded')
    expect(badge).toHaveTextContent('Refunded')
    expect(badge).toHaveClass('bg-yellow-100') // warning variant
  })

  it('renders failed status correctly', () => {
    render(<PaymentStatusBadge status="failed" />)
    const badge = screen.getByTestId('payment-status-failed')
    expect(badge).toHaveTextContent('Failed')
    expect(badge).toHaveClass('bg-red-100') // danger variant
  })

  it('accepts custom className', () => {
    render(<PaymentStatusBadge status="paid" className="ml-2" />)
    const badge = screen.getByTestId('payment-status-paid')
    expect(badge).toHaveClass('ml-2')
  })
})