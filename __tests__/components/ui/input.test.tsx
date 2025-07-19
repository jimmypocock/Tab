/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '@/components/ui'

describe('Input Component', () => {
  it('renders with basic props', () => {
    render(<Input placeholder="Enter text" />)
    const input = screen.getByPlaceholderText('Enter text')
    expect(input).toBeInTheDocument()
  })

  it('renders with label', () => {
    render(<Input label="Email Address" id="email" />)
    const label = screen.getByText('Email Address')
    const input = screen.getByLabelText('Email Address')
    
    expect(label).toBeInTheDocument()
    expect(input).toBeInTheDocument()
    expect(label).toHaveAttribute('for', 'email')
  })

  it('renders with helper text', () => {
    render(<Input helperText="Enter your email address" />)
    const helperText = screen.getByText('Enter your email address')
    expect(helperText).toBeInTheDocument()
    expect(helperText).toHaveClass('text-gray-500')
  })

  it('renders with error state', () => {
    render(<Input error="Email is required" aria-describedby="email-error" />)
    const errorText = screen.getByText('Email is required')
    const input = screen.getByRole('textbox')
    
    expect(errorText).toBeInTheDocument()
    expect(errorText).toHaveClass('text-red-600')
    expect(input).toHaveClass('border-red-300') // Component uses border-red-300
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('handles user input', async () => {
    const handleChange = jest.fn()
    const user = userEvent.setup()
    
    render(<Input onChange={handleChange} />)
    const input = screen.getByRole('textbox')
    
    await user.type(input, 'test@example.com')
    expect(handleChange).toHaveBeenCalled()
    expect(input).toHaveValue('test@example.com')
  })

  it('can be disabled', () => {
    render(<Input disabled />)
    const input = screen.getByRole('textbox')
    
    expect(input).toBeDisabled()
    // Component doesn't have disabled:bg-gray-50 class
  })

  it('accepts different input types', () => {
    const { rerender } = render(<Input type="email" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email')
    
    rerender(<Input type="password" />)
    // Password inputs don't have role="textbox"
    const passwordInput = document.querySelector('input[type="password"]')
    expect(passwordInput).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<Input className="custom-class" />)
    const input = screen.getByRole('textbox')
    
    expect(input).toHaveClass('custom-class')
    // Still has default styles
    expect(input).toHaveClass('border-gray-300')
  })

  it('forwards ref correctly', () => {
    const ref = jest.fn()
    render(<Input ref={ref} />)
    
    expect(ref).toHaveBeenCalled()
    expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLInputElement)
  })

  it('shows required attribute when required', () => {
    render(<Input label="Email" required />)
    const input = screen.getByLabelText('Email')
    
    expect(input).toBeRequired()
    // Component doesn't add asterisk to label
  })

  it('associates helper text and error with input using aria-describedby', () => {
    const { rerender } = render(
      <Input 
        id="test-input"
        helperText="Helper text"
      />
    )
    
    let input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('aria-describedby', 'test-input-helper')
    
    // When error is present, it takes precedence
    rerender(
      <Input 
        id="test-input"
        helperText="Helper text"
        error="Error text"
      />
    )
    
    input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('aria-describedby', 'test-input-error')
  })
})