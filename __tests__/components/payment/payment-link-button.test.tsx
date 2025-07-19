/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor, fireEvent } from '../../helpers/test-utils'
import { PaymentLinkButton } from '@/components/payment'

// Mock clipboard API
const mockWriteText = jest.fn()

describe('PaymentLinkButton', () => {
  beforeEach(() => {
    // Clear any previous clipboard mock
    delete (navigator as any).clipboard
    
    // Set up fresh mock
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText
      },
      writable: true,
      configurable: true
    })
    
    mockWriteText.mockClear()
    mockWriteText.mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders with default props', () => {
    render(<PaymentLinkButton tabId="tab_123" />)
    
    const button = screen.getByRole('button', { name: /copy payment link/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent('Copy Link')
  })

  it('copies payment link on click', async () => {
    render(<PaymentLinkButton tabId="tab_123" baseUrl="https://example.com" />)
    
    const button = screen.getByRole('button')
    fireEvent.click(button)
    
    // Wait for the async operation
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('https://example.com/pay/tab_123')
    })
  })

  it('shows success state after copying', async () => {
    render(<PaymentLinkButton tabId="tab_456" />)
    
    const button = screen.getByRole('button')
    fireEvent.click(button)
    
    // Wait for state to update
    await waitFor(() => {
      expect(button).toHaveTextContent('Copied!')
    })
    
    // Should revert back after timeout
    await waitFor(() => {
      expect(button).toHaveTextContent('Copy Link')
    }, { timeout: 3000 })
  })

  it('handles copy failure gracefully', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation()
    mockWriteText.mockRejectedValue(new Error('Copy failed'))
    
    render(<PaymentLinkButton tabId="tab_789" />)
    
    const button = screen.getByRole('button')
    fireEvent.click(button)
    
    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith('Failed to copy payment link:', expect.any(Error))
    })
    
    // Button should still show original text
    expect(button).toHaveTextContent('Copy Link')
    
    consoleError.mockRestore()
  })

  it('renders without icon when showIcon is false', () => {
    render(<PaymentLinkButton tabId="tab_123" showIcon={false} />)
    
    const button = screen.getByRole('button')
    const svg = button.querySelector('svg')
    expect(svg).not.toBeInTheDocument()
  })

  it('applies different variants', () => {
    const { rerender } = render(<PaymentLinkButton tabId="tab_123" variant="primary" />)
    expect(screen.getByRole('button')).toHaveClass('bg-blue-600')
    
    rerender(<PaymentLinkButton tabId="tab_123" variant="secondary" />)
    expect(screen.getByRole('button')).toHaveClass('bg-gray-200')
    
    rerender(<PaymentLinkButton tabId="tab_123" variant="ghost" />)
    expect(screen.getByRole('button')).toHaveClass('text-gray-700')
  })

  it('applies different sizes', () => {
    const { rerender } = render(<PaymentLinkButton tabId="tab_123" size="sm" />)
    expect(screen.getByRole('button')).toHaveClass('px-2.5')
    
    rerender(<PaymentLinkButton tabId="tab_123" size="md" />)
    expect(screen.getByRole('button')).toHaveClass('px-3')
    
    rerender(<PaymentLinkButton tabId="tab_123" size="lg" />)
    expect(screen.getByRole('button')).toHaveClass('px-4')
  })

  it('accepts custom className', () => {
    render(<PaymentLinkButton tabId="tab_123" className="custom-class" />)
    
    const button = screen.getByRole('button')
    expect(button).toHaveClass('custom-class')
  })

  it('uses window.location.origin when baseUrl is not provided', async () => {
    render(<PaymentLinkButton tabId="tab_local" />)
    
    const button = screen.getByRole('button')
    fireEvent.click(button)
    
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('http://localhost/pay/tab_local')
    })
  })
})