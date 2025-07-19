/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { PageHeader } from '@/components/dashboard'
import { Button } from '@/components/ui'

describe('PageHeader', () => {
  it('renders title', () => {
    render(<PageHeader title="Dashboard" />)
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dashboard')
  })

  it('renders description when provided', () => {
    render(
      <PageHeader 
        title="Dashboard" 
        description="Welcome to your dashboard" 
      />
    )
    
    expect(screen.getByText('Welcome to your dashboard')).toBeInTheDocument()
  })

  it('renders action when provided', () => {
    render(
      <PageHeader 
        title="Dashboard" 
        action={<Button>Create New</Button>}
      />
    )
    
    expect(screen.getByRole('button', { name: 'Create New' })).toBeInTheDocument()
  })

  it('renders multiple actions', () => {
    render(
      <PageHeader 
        title="Dashboard" 
        action={
          <>
            <Button variant="secondary">Export</Button>
            <Button variant="primary">Create New</Button>
          </>
        }
      />
    )
    
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create New' })).toBeInTheDocument()
  })

  it('renders children when provided', () => {
    render(
      <PageHeader title="Dashboard">
        <div data-testid="custom-content">Custom content</div>
      </PageHeader>
    )
    
    expect(screen.getByTestId('custom-content')).toBeInTheDocument()
  })

  it('accepts custom className', () => {
    const { container } = render(
      <PageHeader title="Dashboard" className="custom-header" />
    )
    
    expect(container.firstChild).toHaveClass('custom-header')
    expect(container.firstChild).toHaveClass('mb-6') // Default class should still be there
  })

  it('renders complete header with all props', () => {
    render(
      <PageHeader
        title="Payments"
        description="Manage your payment transactions"
        action={<Button>New Payment</Button>}
      >
        <div className="mt-4">Additional filters</div>
      </PageHeader>
    )
    
    expect(screen.getByText('Payments')).toBeInTheDocument()
    expect(screen.getByText('Manage your payment transactions')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New Payment' })).toBeInTheDocument()
    expect(screen.getByText('Additional filters')).toBeInTheDocument()
  })
})