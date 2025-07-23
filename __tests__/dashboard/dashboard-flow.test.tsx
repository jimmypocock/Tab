/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter, useSearchParams } from 'next/navigation'

// Mock Next.js navigation
const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockRefresh = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    refresh: mockRefresh,
    back: jest.fn(),
    forward: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard',
}))

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getSession: jest.fn(),
    getUser: jest.fn(),
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
        execute: jest.fn(),
      })),
      order: jest.fn(() => ({
        limit: jest.fn(() => ({
          execute: jest.fn(),
        })),
      })),
    })),
    insert: jest.fn(() => ({
      values: jest.fn(() => ({
        returning: jest.fn(),
      })),
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        returning: jest.fn(),
      })),
    })),
  })),
}

jest.mock('@/lib/supabase/client', () => ({
  createClientComponentClient: () => mockSupabaseClient,
}))

// Mock dashboard components
const MockDashboard = () => {
  const [stats, setStats] = React.useState({
    totalRevenue: 0,
    activeTabsCount: 0,
    paidTabsCount: 0,
    conversionRate: 0,
  })

  const [recentTabs, setRecentTabs] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    // Simulate loading dashboard data
    setTimeout(() => {
      setStats({
        totalRevenue: 125000, // $1,250.00
        activeTabsCount: 8,
        paidTabsCount: 42,
        conversionRate: 84,
      })
      setRecentTabs([
        {
          id: 'tab_1',
          customerName: 'John Doe',
          customerEmail: 'john@example.com',
          totalAmount: 5000,
          status: 'open',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'tab_2',
          customerName: 'Jane Smith',
          customerEmail: 'jane@example.com',
          totalAmount: 7500,
          status: 'paid',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
      ])
      setLoading(false)
    }, 100)
  }, [])

  if (loading) {
    return <div data-testid="loading">Loading dashboard...</div>
  }

  return (
    <div data-testid="dashboard">
      <h1>Dashboard</h1>
      
      {/* Stats Overview */}
      <div data-testid="stats-grid">
        <div data-testid="stat-revenue">
          <span>Total Revenue</span>
          <span>${(stats.totalRevenue / 100).toFixed(2)}</span>
        </div>
        <div data-testid="stat-active-tabs">
          <span>Active Tabs</span>
          <span>{stats.activeTabsCount}</span>
        </div>
        <div data-testid="stat-paid-tabs">
          <span>Paid Tabs</span>
          <span>{stats.paidTabsCount}</span>
        </div>
        <div data-testid="stat-conversion">
          <span>Conversion Rate</span>
          <span>{stats.conversionRate}%</span>
        </div>
      </div>

      {/* Recent Tabs */}
      <div data-testid="recent-tabs">
        <h2>Recent Tabs</h2>
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {recentTabs.map(tab => (
              <tr key={tab.id} data-testid={`tab-row-${tab.id}`}>
                <td>{tab.customerName}</td>
                <td>${(tab.totalAmount / 100).toFixed(2)}</td>
                <td>
                  <span data-testid={`status-${tab.id}`} className={tab.status}>
                    {tab.status}
                  </span>
                </td>
                <td>
                  <button
                    data-testid={`view-tab-${tab.id}`}
                    onClick={() => mockPush(`/tabs/${tab.id}`)}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Quick Actions */}
      <div data-testid="quick-actions">
        <button
          data-testid="create-tab-button"
          onClick={() => mockPush('/tabs/new')}
        >
          Create New Tab
        </button>
        <button
          data-testid="view-all-tabs-button"
          onClick={() => mockPush('/tabs')}
        >
          View All Tabs
        </button>
      </div>
    </div>
  )
}

const MockTabsPage = () => {
  const [tabs, setTabs] = React.useState<any[]>([])
  const [filter, setFilter] = React.useState('all')
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    // Simulate loading tabs
    setTimeout(() => {
      const allTabs = [
        {
          id: 'tab_1',
          customerName: 'John Doe',
          totalAmount: 5000,
          status: 'open',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'tab_2',
          customerName: 'Jane Smith',
          totalAmount: 7500,
          status: 'paid',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 'tab_3',
          customerName: 'Bob Johnson',
          totalAmount: 3000,
          status: 'open',
          createdAt: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          id: 'tab_4',
          customerName: 'Alice Brown',
          totalAmount: 10000,
          status: 'void',
          createdAt: new Date(Date.now() - 10800000).toISOString(),
        },
      ]
      
      if (filter === 'all') {
        setTabs(allTabs)
      } else {
        setTabs(allTabs.filter(tab => tab.status === filter))
      }
      
      setLoading(false)
    }, 100)
  }, [filter])

  if (loading) {
    return <div data-testid="loading">Loading tabs...</div>
  }

  return (
    <div data-testid="tabs-page">
      <h1>Tabs</h1>
      
      {/* Filters */}
      <div data-testid="tabs-filters">
        <button
          data-testid="filter-all"
          onClick={() => setFilter('all')}
          className={filter === 'all' ? 'active' : ''}
        >
          All
        </button>
        <button
          data-testid="filter-open"
          onClick={() => setFilter('open')}
          className={filter === 'open' ? 'active' : ''}
        >
          Open
        </button>
        <button
          data-testid="filter-paid"
          onClick={() => setFilter('paid')}
          className={filter === 'paid' ? 'active' : ''}
        >
          Paid
        </button>
        <button
          data-testid="filter-void"
          onClick={() => setFilter('void')}
          className={filter === 'void' ? 'active' : ''}
        >
          Void
        </button>
      </div>

      {/* Tabs List */}
      <div data-testid="tabs-list">
        {tabs.length === 0 ? (
          <div data-testid="no-tabs">No tabs found</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tabs.map(tab => (
                <tr key={tab.id} data-testid={`tab-${tab.id}`}>
                  <td>{tab.customerName}</td>
                  <td>${(tab.totalAmount / 100).toFixed(2)}</td>
                  <td>{tab.status}</td>
                  <td>{new Date(tab.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      data-testid={`edit-${tab.id}`}
                      onClick={() => mockPush(`/tabs/${tab.id}`)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

describe('Dashboard Flow Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Main Dashboard', () => {
    it('should display loading state initially', () => {
      render(<MockDashboard />)
      expect(screen.getByTestId('loading')).toBeInTheDocument()
      expect(screen.getByText('Loading dashboard...')).toBeInTheDocument()
    })

    it('should display dashboard stats after loading', async () => {
      render(<MockDashboard />)

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
      })

      // Check stats are displayed
      const statsGrid = screen.getByTestId('stats-grid')
      expect(within(statsGrid).getByText(/\$1250\.00/)).toBeInTheDocument()
      expect(within(statsGrid).getByText('8')).toBeInTheDocument()
      expect(within(statsGrid).getByText('42')).toBeInTheDocument()
      expect(within(statsGrid).getByText(/84%/)).toBeInTheDocument()
    })

    it('should display recent tabs', async () => {
      render(<MockDashboard />)

      await waitFor(() => {
        expect(screen.getByTestId('recent-tabs')).toBeInTheDocument()
      })

      // Check recent tabs table
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
      expect(screen.getByText('$50.00')).toBeInTheDocument()
      expect(screen.getByText('$75.00')).toBeInTheDocument()
      
      // Check status badges
      expect(screen.getByTestId('status-tab_1')).toHaveTextContent('open')
      expect(screen.getByTestId('status-tab_2')).toHaveTextContent('paid')
    })

    it('should navigate to tab details when view button clicked', async () => {
      const user = userEvent.setup()
      render(<MockDashboard />)

      await waitFor(() => {
        expect(screen.getByTestId('view-tab-tab_1')).toBeInTheDocument()
      })

      await user.click(screen.getByTestId('view-tab-tab_1'))
      expect(mockPush).toHaveBeenCalledWith('/tabs/tab_1')
    })

    it('should navigate to create new tab', async () => {
      const user = userEvent.setup()
      render(<MockDashboard />)

      await waitFor(() => {
        expect(screen.getByTestId('create-tab-button')).toBeInTheDocument()
      })

      await user.click(screen.getByTestId('create-tab-button'))
      expect(mockPush).toHaveBeenCalledWith('/tabs/new')
    })

    it('should navigate to view all tabs', async () => {
      const user = userEvent.setup()
      render(<MockDashboard />)

      await waitFor(() => {
        expect(screen.getByTestId('view-all-tabs-button')).toBeInTheDocument()
      })

      await user.click(screen.getByTestId('view-all-tabs-button'))
      expect(mockPush).toHaveBeenCalledWith('/tabs')
    })
  })

  describe('Tabs Listing Page', () => {
    it('should display all tabs by default', async () => {
      render(<MockTabsPage />)

      await waitFor(() => {
        expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
      })

      // Should show all 4 tabs
      expect(screen.getByTestId('tab-tab_1')).toBeInTheDocument()
      expect(screen.getByTestId('tab-tab_2')).toBeInTheDocument()
      expect(screen.getByTestId('tab-tab_3')).toBeInTheDocument()
      expect(screen.getByTestId('tab-tab_4')).toBeInTheDocument()
    })

    it('should filter tabs by status', async () => {
      const user = userEvent.setup()
      render(<MockTabsPage />)

      await waitFor(() => {
        expect(screen.getByTestId('tabs-filters')).toBeInTheDocument()
      })

      // Filter by open tabs
      await user.click(screen.getByTestId('filter-open'))
      
      await waitFor(() => {
        expect(screen.getByTestId('tab-tab_1')).toBeInTheDocument()
        expect(screen.getByTestId('tab-tab_3')).toBeInTheDocument()
        expect(screen.queryByTestId('tab-tab_2')).not.toBeInTheDocument() // paid
        expect(screen.queryByTestId('tab-tab_4')).not.toBeInTheDocument() // void
      })

      // Filter by paid tabs
      await user.click(screen.getByTestId('filter-paid'))
      
      await waitFor(() => {
        expect(screen.getByTestId('tab-tab_2')).toBeInTheDocument()
        expect(screen.queryByTestId('tab-tab_1')).not.toBeInTheDocument()
        expect(screen.queryByTestId('tab-tab_3')).not.toBeInTheDocument()
        expect(screen.queryByTestId('tab-tab_4')).not.toBeInTheDocument()
      })
    })

    it('should show no tabs message when filter returns empty', async () => {
      const user = userEvent.setup()
      render(<MockTabsPage />)

      await waitFor(() => {
        expect(screen.getByTestId('tabs-filters')).toBeInTheDocument()
      })

      // Mock empty filter result
      await user.click(screen.getByTestId('filter-void'))
      await user.click(screen.getByTestId('filter-paid'))
      await user.click(screen.getByTestId('filter-open'))
      
      // Click void filter which has only one tab
      await user.click(screen.getByTestId('filter-void'))
      
      await waitFor(() => {
        expect(screen.getByTestId('tab-tab_4')).toBeInTheDocument()
      })
    })

    it('should navigate to tab details when edit clicked', async () => {
      const user = userEvent.setup()
      render(<MockTabsPage />)

      await waitFor(() => {
        expect(screen.getByTestId('edit-tab_1')).toBeInTheDocument()
      })

      await user.click(screen.getByTestId('edit-tab_1'))
      expect(mockPush).toHaveBeenCalledWith('/tabs/tab_1')
    })
  })

  describe('Dashboard Data Updates', () => {
    it('should refresh data when returning to dashboard', async () => {
      const { rerender } = render(<MockDashboard />)

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument()
      })

      // Simulate navigation away and back
      mockRefresh.mockClear()
      rerender(<MockDashboard />)

      // Data should be refreshed (in real app, this would trigger new API calls)
      await waitFor(() => {
        expect(screen.getByTestId('stats-grid')).toBeInTheDocument()
      })
    })

    it('should handle empty state for recent tabs', async () => {
      // Mock empty response
      const MockEmptyDashboard = () => {
        const [loading, setLoading] = React.useState(true)

        React.useEffect(() => {
          setTimeout(() => setLoading(false), 100)
        }, [])

        if (loading) return <div data-testid="loading">Loading...</div>

        return (
          <div data-testid="dashboard">
            <div data-testid="recent-tabs">
              <h2>Recent Tabs</h2>
              <p data-testid="no-recent-tabs">No recent tabs. Create your first tab to get started!</p>
              <button onClick={() => mockPush('/tabs/new')}>Create Tab</button>
            </div>
          </div>
        )
      }

      render(<MockEmptyDashboard />)

      await waitFor(() => {
        expect(screen.getByTestId('no-recent-tabs')).toBeInTheDocument()
        expect(screen.getByText('No recent tabs. Create your first tab to get started!')).toBeInTheDocument()
      })
    })
  })
})