/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { EmptyState } from '@/components/dashboard'
import { FileText } from 'lucide-react'

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState
        title="No tabs found"
        description="Get started by creating your first tab"
      />
    )
    
    expect(screen.getByText('No tabs found')).toBeInTheDocument()
    expect(screen.getByText('Get started by creating your first tab')).toBeInTheDocument()
  })

  it('renders with icon', () => {
    render(
      <EmptyState
        icon={FileText}
        title="No documents"
        description="Upload your first document to get started"
      />
    )
    
    const icon = screen.getByText('No documents').parentElement?.parentElement?.querySelector('svg')
    expect(icon).toBeInTheDocument()
  })

  it('renders primary action button', () => {
    const handleClick = jest.fn()
    
    render(
      <EmptyState
        title="No items"
        description="Create your first item"
        action={{
          label: 'Create Item',
          onClick: handleClick
        }}
      />
    )
    
    const button = screen.getByRole('button', { name: 'Create Item' })
    expect(button).toHaveClass('bg-blue-600') // Primary variant
    
    fireEvent.click(button)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('renders secondary action button', () => {
    const handleSecondary = jest.fn()
    
    render(
      <EmptyState
        title="No items"
        description="Import or create items"
        secondaryAction={{
          label: 'Import',
          onClick: handleSecondary
        }}
      />
    )
    
    const button = screen.getByRole('button', { name: 'Import' })
    expect(button).toHaveClass('bg-gray-200') // Secondary variant
    
    fireEvent.click(button)
    expect(handleSecondary).toHaveBeenCalledTimes(1)
  })

  it('renders both action buttons', () => {
    const handlePrimary = jest.fn()
    const handleSecondary = jest.fn()
    
    render(
      <EmptyState
        title="No items"
        description="Get started"
        action={{
          label: 'Create New',
          onClick: handlePrimary
        }}
        secondaryAction={{
          label: 'Learn More',
          onClick: handleSecondary
        }}
      />
    )
    
    expect(screen.getByRole('button', { name: 'Create New' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Learn More' })).toBeInTheDocument()
  })

  it('accepts custom className', () => {
    const { container } = render(
      <EmptyState
        title="Empty"
        description="Nothing here"
        className="custom-empty"
      />
    )
    
    const emptyStateDiv = container.querySelector('.text-center')
    expect(emptyStateDiv).toHaveClass('custom-empty')
    expect(emptyStateDiv).toHaveClass('text-center')
  })

  it('renders complete empty state with all props', () => {
    const handleCreate = jest.fn()
    const handleImport = jest.fn()
    
    render(
      <EmptyState
        icon={FileText}
        title="No invoices yet"
        description="Create your first invoice or import existing ones"
        action={{
          label: 'Create Invoice',
          onClick: handleCreate
        }}
        secondaryAction={{
          label: 'Import CSV',
          onClick: handleImport
        }}
        className="my-8"
      />
    )
    
    // Check all elements are present
    expect(screen.getByText('No invoices yet')).toBeInTheDocument()
    expect(screen.getByText(/Create your first invoice/)).toBeInTheDocument()
    
    // Check icon
    const iconContainer = screen.getByText('No invoices yet').parentElement?.parentElement
    expect(iconContainer?.querySelector('svg')).toBeInTheDocument()
    
    // Check buttons
    const createButton = screen.getByRole('button', { name: 'Create Invoice' })
    const importButton = screen.getByRole('button', { name: 'Import CSV' })
    
    fireEvent.click(createButton)
    expect(handleCreate).toHaveBeenCalledTimes(1)
    
    fireEvent.click(importButton)
    expect(handleImport).toHaveBeenCalledTimes(1)
  })
})