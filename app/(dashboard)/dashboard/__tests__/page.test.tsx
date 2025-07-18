import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import DashboardPage from '../page'
import { getDashboardStats, getRecentTabs } from '@/lib/services/dashboard'
import { createClient } from '@/lib/supabase/server'

// Mock the dependencies
jest.mock('@/lib/supabase/server')
jest.mock('@/lib/services/dashboard')

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
const mockGetDashboardStats = getDashboardStats as jest.MockedFunction<typeof getDashboardStats>
const mockGetRecentTabs = getRecentTabs as jest.MockedFunction<typeof getRecentTabs>

describe('DashboardPage', () => {
  beforeEach(() => {
    // Mock authenticated user
    mockCreateClient.mockReturnValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
          error: null,
        }),
      },
    } as any)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders dashboard with stats', async () => {
    // Mock dashboard stats
    mockGetDashboardStats.mockResolvedValue({
      total_tabs: 10,
      open_tabs: 3,
      total_revenue: 1500.50,
      pending_revenue: 250.75,
    })

    // Mock recent tabs
    mockGetRecentTabs.mockResolvedValue([
      {
        id: 'tab-1',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        totalAmount: '100.00',
        paidAmount: '100.00',
        status: 'paid',
        createdAt: '2025-01-01T00:00:00Z',
        lineItemCount: 2,
      },
    ])

    const page = await DashboardPage()
    render(page)

    // Check stats are displayed
    expect(screen.getByText('$1500.50')).toBeInTheDocument()
    expect(screen.getByText('$250.75')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()

    // Check recent tabs
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('$100.00')).toBeInTheDocument()
  })

  it('handles undefined stats gracefully', async () => {
    // Mock undefined stats (simulating the error you encountered)
    mockGetDashboardStats.mockResolvedValue(undefined as any)
    mockGetRecentTabs.mockResolvedValue([])

    const page = await DashboardPage()
    render(page)

    // Should display zeros instead of crashing
    expect(screen.getByText('$0.00')).toBeInTheDocument()
    expect(screen.getAllByText('0')).toHaveLength(2) // total_tabs and open_tabs
  })

  it('handles stats with missing properties', async () => {
    // Mock partial stats
    mockGetDashboardStats.mockResolvedValue({
      total_tabs: 5,
      // Missing other properties
    } as any)
    mockGetRecentTabs.mockResolvedValue([])

    const page = await DashboardPage()
    render(page)

    // Should display defaults for missing values
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('$0.00')).toBeInTheDocument()
  })

  it('displays empty state when no tabs exist', async () => {
    mockGetDashboardStats.mockResolvedValue({
      total_tabs: 0,
      open_tabs: 0,
      total_revenue: 0,
      pending_revenue: 0,
    })
    mockGetRecentTabs.mockResolvedValue([])

    const page = await DashboardPage()
    render(page)

    expect(screen.getByText('No tabs yet. Create your first tab to get started!')).toBeInTheDocument()
  })

  it('formats customer display name correctly', async () => {
    mockGetDashboardStats.mockResolvedValue({
      total_tabs: 1,
      open_tabs: 1,
      total_revenue: 0,
      pending_revenue: 100,
    })

    // Tab with no customer name, only email
    mockGetRecentTabs.mockResolvedValue([
      {
        id: 'tab-2',
        customerName: null,
        customerEmail: 'customer@example.com',
        totalAmount: '100.00',
        paidAmount: '0.00',
        status: 'open',
        createdAt: '2025-01-01T00:00:00Z',
        lineItemCount: 1,
      },
    ])

    const page = await DashboardPage()
    render(page)

    // Should display email when name is null
    expect(screen.getByText('customer@example.com')).toBeInTheDocument()
  })
})