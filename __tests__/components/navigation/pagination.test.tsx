/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { Pagination } from '@/components/navigation'

describe('Pagination', () => {
  const mockOnPageChange = jest.fn()

  beforeEach(() => {
    mockOnPageChange.mockClear()
  })

  it('renders basic pagination info', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={10}
        onPageChange={mockOnPageChange}
      />
    )
    
    // The pagination info is only visible on desktop (sm:flex)
    const pageInfo = screen.getAllByText((content, element) => {
      return element?.textContent === 'Page 1 of 10'
    })
    expect(pageInfo.length).toBeGreaterThan(0)
  })

  it('disables previous button on first page', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    )
    
    const prevButtons = screen.getAllByRole('button', { name: 'Previous' })
    prevButtons.forEach(button => {
      expect(button).toBeDisabled()
    })
  })

  it('disables next button on last page', () => {
    render(
      <Pagination
        currentPage={5}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    )
    
    const nextButtons = screen.getAllByRole('button', { name: 'Next' })
    nextButtons.forEach(button => {
      expect(button).toBeDisabled()
    })
  })

  it('calls onPageChange when previous button is clicked', () => {
    render(
      <Pagination
        currentPage={3}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    )
    
    const prevButtons = screen.getAllByRole('button', { name: 'Previous' })
    fireEvent.click(prevButtons[0])
    
    expect(mockOnPageChange).toHaveBeenCalledWith(2)
  })

  it('calls onPageChange when next button is clicked', () => {
    render(
      <Pagination
        currentPage={3}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    )
    
    const nextButtons = screen.getAllByRole('button', { name: 'Next' })
    fireEvent.click(nextButtons[0])
    
    expect(mockOnPageChange).toHaveBeenCalledWith(4)
  })

  it('renders page numbers when showPageNumbers is true', () => {
    render(
      <Pagination
        currentPage={3}
        totalPages={5}
        onPageChange={mockOnPageChange}
        showPageNumbers={true}
      />
    )
    
    // Should show all page numbers for small total
    const buttons = screen.getAllByRole('button')
    const pageNumbers = buttons.filter(btn => /^\d+$/.test(btn.textContent || ''))
    expect(pageNumbers).toHaveLength(5)
    expect(pageNumbers.map(btn => btn.textContent)).toEqual(['1', '2', '3', '4', '5'])
  })

  it('highlights current page', () => {
    render(
      <Pagination
        currentPage={3}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    )
    
    const buttons = screen.getAllByRole('button')
    const currentPageButton = buttons.find(btn => btn.textContent === '3')
    expect(currentPageButton).toHaveClass('bg-blue-600')
    expect(currentPageButton).toHaveClass('text-white')
    expect(currentPageButton).toHaveAttribute('aria-current', 'page')
  })

  it('shows dots for large page ranges', () => {
    render(
      <Pagination
        currentPage={10}
        totalPages={20}
        onPageChange={mockOnPageChange}
      />
    )
    
    // Should show dots
    const dots = screen.getAllByText('...')
    expect(dots).toHaveLength(2)
  })

  it('does not show page numbers when showPageNumbers is false', () => {
    render(
      <Pagination
        currentPage={3}
        totalPages={5}
        onPageChange={mockOnPageChange}
        showPageNumbers={false}
      />
    )
    
    // Should not show individual page buttons
    expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '2' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '3' })).not.toBeInTheDocument()
  })

  it('accepts custom className', () => {
    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        onPageChange={mockOnPageChange}
        className="custom-pagination"
      />
    )
    
    // There are multiple navigation elements, find the main one
    const navs = screen.getAllByRole('navigation')
    const mainNav = navs.find(nav => nav.classList.contains('custom-pagination'))
    expect(mainNav).toBeInTheDocument()
  })

  it('handles click on page number', () => {
    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        onPageChange={mockOnPageChange}
      />
    )
    
    const buttons = screen.getAllByRole('button')
    const page4Button = buttons.find(btn => btn.textContent === '4')
    fireEvent.click(page4Button!)
    expect(mockOnPageChange).toHaveBeenCalledWith(4)
  })

  it('respects siblingCount prop', () => {
    render(
      <Pagination
        currentPage={10}
        totalPages={20}
        onPageChange={mockOnPageChange}
        siblingCount={2}
      />
    )
    
    // Should show more page numbers around current page
    const buttons = screen.getAllByRole('button')
    const pageNumbers = buttons.filter(btn => /^\d+$/.test(btn.textContent || ''))
    const pageTexts = pageNumbers.map(btn => btn.textContent)
    
    expect(pageTexts).toContain('8')
    expect(pageTexts).toContain('9')
    expect(pageTexts).toContain('10')
    expect(pageTexts).toContain('11')
    expect(pageTexts).toContain('12')
  })
})