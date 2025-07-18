/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TabsList } from '@/components/dashboard/tabs-list'
import { useRouter } from 'next/navigation'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}))

// Mock fetch
global.fetch = jest.fn()

describe('TabsList Component', () => {
  const mockPush = jest.fn()
  const mockTabs = [
    {
      id: 'tab_1',
      customerEmail: 'customer1@example.com',
      customerName: 'John Doe',
      total: '100.00',
      paidAmount: '100.00',
      status: 'paid',
      currency: 'USD',
      createdAt: '2024-01-15T10:00:00Z'
    },
    {
      id: 'tab_2',
      customerEmail: 'customer2@example.com',
      customerName: 'Jane Smith',
      total: '250.00',
      paidAmount: '50.00',
      status: 'partial',
      currency: 'USD',
      createdAt: '2024-01-14T15:30:00Z'
    },
    {
      id: 'tab_3',
      customerEmail: 'customer3@example.com',
      total: '75.00',
      paidAmount: '0.00',
      status: 'open',
      currency: 'USD',
      createdAt: '2024-01-13T09:00:00Z'
    }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({ push: mockPush })
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockTabs })
    })
  })

  it('renders tabs list with data', async () => {
    render(<TabsList />)

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('customer1@example.com')).toBeInTheDocument()
    })

    // Check all tabs are rendered
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByText('$100.00')).toBeInTheDocument()
    expect(screen.getByText('$250.00')).toBeInTheDocument()
    expect(screen.getByText('$75.00')).toBeInTheDocument()
  })

  it('displays correct status badges', async () => {
    render(<TabsList />)

    await waitFor(() => {
      expect(screen.getByText('Paid')).toBeInTheDocument()
      expect(screen.getByText('Partial')).toBeInTheDocument()
      expect(screen.getByText('Open')).toBeInTheDocument()
    })
  })

  it('filters tabs by status', async () => {
    const user = userEvent.setup()
    render(<TabsList />)

    await waitFor(() => {
      expect(screen.getByText('customer1@example.com')).toBeInTheDocument()
    })

    // Click on status filter
    const paidFilter = screen.getByRole('button', { name: /paid/i })
    await user.click(paidFilter)

    // Fetch should be called with status filter
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('status=paid'),
      expect.any(Object)
    )
  })

  it('handles search functionality', async () => {
    const user = userEvent.setup()
    render(<TabsList />)

    await waitFor(() => {
      expect(screen.getByText('customer1@example.com')).toBeInTheDocument()
    })

    // Type in search box
    const searchInput = screen.getByPlaceholderText(/search/i)
    await user.type(searchInput, 'john')

    // Should filter results
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=john'),
        expect.any(Object)
      )
    })
  })

  it('navigates to tab details on row click', async () => {
    const user = userEvent.setup()
    render(<TabsList />)

    await waitFor(() => {
      expect(screen.getByText('customer1@example.com')).toBeInTheDocument()
    })

    // Click on a tab row
    const tabRow = screen.getByText('John Doe').closest('tr')
    await user.click(tabRow!)

    expect(mockPush).toHaveBeenCalledWith('/tabs/tab_1')
  })

  it('copies payment link on button click', async () => {
    const user = userEvent.setup()
    
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined)
      }
    })

    render(<TabsList />)

    await waitFor(() => {
      expect(screen.getByText('customer1@example.com')).toBeInTheDocument()
    })

    // Click copy link button
    const copyButtons = screen.getAllByLabelText(/copy payment link/i)
    await user.click(copyButtons[0])

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('/pay/tab_1')
    )

    // Should show success message
    await waitFor(() => {
      expect(screen.getByText(/copied/i)).toBeInTheDocument()
    })
  })

  it('handles empty state', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] })
    })

    render(<TabsList />)

    await waitFor(() => {
      expect(screen.getByText(/no tabs found/i)).toBeInTheDocument()
    })

    // Should show create button
    expect(screen.getByRole('button', { name: /create.*tab/i })).toBeInTheDocument()
  })

  it('handles error state', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    render(<TabsList />)

    await waitFor(() => {
      expect(screen.getByText(/error loading tabs/i)).toBeInTheDocument()
    })

    // Should show retry button
    const retryButton = screen.getByRole('button', { name: /retry/i })
    expect(retryButton).toBeInTheDocument()
  })

  it('handles pagination', async () => {
    const user = userEvent.setup()
    
    // Mock response with pagination info
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: mockTabs,
        pagination: {
          page: 1,
          limit: 10,
          total: 25,
          totalPages: 3
        }
      })
    })

    render(<TabsList />)

    await waitFor(() => {
      expect(screen.getByText('customer1@example.com')).toBeInTheDocument()
    })

    // Should show pagination controls
    expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument()
    
    // Click next page
    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('page=2'),
      expect.any(Object)
    )
  })

  it('displays balance information correctly', async () => {
    render(<TabsList />)

    await waitFor(() => {
      expect(screen.getByText('customer1@example.com')).toBeInTheDocument()
    })

    // Check balance calculations
    const rows = screen.getAllByRole('row')
    
    // Tab 1: Fully paid
    expect(rows[1]).toHaveTextContent('$100.00')
    expect(rows[1]).toHaveTextContent('Paid')
    
    // Tab 2: Partial payment
    expect(rows[2]).toHaveTextContent('$250.00')
    expect(rows[2]).toHaveTextContent('$50.00') // Paid amount
    expect(rows[2]).toHaveTextContent('Partial')
    
    // Tab 3: No payment
    expect(rows[3]).toHaveTextContent('$75.00')
    expect(rows[3]).toHaveTextContent('Open')
  })
})