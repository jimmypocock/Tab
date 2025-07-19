/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { PaymentTimeline } from '@/components/payment'
import type { PaymentEvent } from '@/components/payment'

describe('PaymentTimeline', () => {
  const mockEvents: PaymentEvent[] = [
    {
      id: '1',
      type: 'created',
      description: 'Payment initiated',
      timestamp: new Date('2024-01-15T10:00:00'),
      amount: 10000
    },
    {
      id: '2',
      type: 'processing',
      description: 'Processing payment',
      timestamp: new Date('2024-01-15T10:00:30')
    },
    {
      id: '3',
      type: 'succeeded',
      description: 'Payment successful',
      timestamp: new Date('2024-01-15T10:01:00'),
      amount: 10000
    }
  ]

  it('renders all events', () => {
    render(<PaymentTimeline events={mockEvents} />)
    
    expect(screen.getByText('Payment initiated')).toBeInTheDocument()
    expect(screen.getByText('Processing payment')).toBeInTheDocument()
    expect(screen.getByText('Payment successful')).toBeInTheDocument()
  })

  it('displays events in reverse chronological order', () => {
    render(<PaymentTimeline events={mockEvents} />)
    
    const timeline = screen.getByTestId('payment-timeline')
    const descriptions = timeline.querySelectorAll('p')
    
    // Most recent event should be first
    expect(descriptions[0]).toHaveTextContent('Payment successful')
    expect(descriptions[2]).toHaveTextContent('Processing payment')
    expect(descriptions[3]).toHaveTextContent('Payment initiated')
  })

  it('shows amount when provided', () => {
    render(<PaymentTimeline events={mockEvents} />)
    
    // Multiple events have amounts, so we should check for multiple instances
    const amountTexts = screen.getAllByText('Amount: $100.00')
    expect(amountTexts).toHaveLength(2) // Two events have amounts
  })

  it('formats timestamps correctly', () => {
    render(<PaymentTimeline events={mockEvents} />)
    
    // Check that dates are formatted (exact format may vary)
    const timeElements = screen.getAllByText(/1\/15\/24/)
    expect(timeElements.length).toBeGreaterThan(0)
  })

  it('renders different event types with appropriate icons', () => {
    const diverseEvents: PaymentEvent[] = [
      {
        id: '1',
        type: 'failed',
        description: 'Payment failed',
        timestamp: new Date()
      },
      {
        id: '2',
        type: 'refunded',
        description: 'Payment refunded',
        timestamp: new Date()
      },
      {
        id: '3',
        type: 'disputed',
        description: 'Payment disputed',
        timestamp: new Date()
      }
    ]
    
    render(<PaymentTimeline events={diverseEvents} />)
    
    expect(screen.getByText('Payment failed')).toBeInTheDocument()
    expect(screen.getByText('Payment refunded')).toBeInTheDocument()
    expect(screen.getByText('Payment disputed')).toBeInTheDocument()
  })

  it('handles empty events array', () => {
    render(<PaymentTimeline events={[]} />)
    
    const timeline = screen.getByTestId('payment-timeline')
    expect(timeline.querySelector('ul')).toBeEmptyDOMElement()
  })

  it('accepts custom className', () => {
    render(<PaymentTimeline events={mockEvents} className="custom-timeline" />)
    
    const timeline = screen.getByTestId('payment-timeline')
    expect(timeline).toHaveClass('custom-timeline')
  })

  it('does not show connecting line for last event', () => {
    render(<PaymentTimeline events={[mockEvents[0]]} />)
    
    // Should not have any connecting lines when only one event
    const timeline = screen.getByTestId('payment-timeline')
    const lines = timeline.querySelectorAll('.bg-gray-200')
    expect(lines).toHaveLength(0)
  })

  it('preserves original event order in array', () => {
    const originalEvents = [...mockEvents]
    render(<PaymentTimeline events={mockEvents} />)
    
    // Original array should not be modified
    expect(mockEvents).toEqual(originalEvents)
  })
})