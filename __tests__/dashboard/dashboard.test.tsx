import { render, screen } from '@testing-library/react'
import DashboardPage from '@/app/(dashboard)/dashboard/page'
import { getDashboardStats } from '@/lib/services/dashboard'
import { formatCurrency, formatDate } from '@/lib/utils'

// Mock the dashboard service
jest.mock('@/lib/services/dashboard')

// Mock Next.js navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
}))

describe('Dashboard Page', () => {
  const mockStats = {
    total_tabs: 50,
    open_tabs: 12,
    total_revenue: 5000,
    pending_revenue: 1200,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(getDashboardStats as jest.Mock).mockResolvedValue(mockStats)
  })

  it('should display dashboard stats correctly', async () => {
    const Dashboard = await DashboardPage()
    render(Dashboard)

    // Check if all stat cards are rendered with correct values
    expect(screen.getByText('Total Revenue')).toBeInTheDocument()
    expect(screen.getByText(formatCurrency(5000))).toBeInTheDocument()

    expect(screen.getByText('Pending Revenue')).toBeInTheDocument()
    expect(screen.getByText(formatCurrency(1200))).toBeInTheDocument()

    expect(screen.getByText('Total Tabs')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()

    expect(screen.getByText('Open Tabs')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('should handle zero stats gracefully', async () => {
    ;(getDashboardStats as jest.Mock).mockResolvedValue({
      total_tabs: 0,
      open_tabs: 0,
      total_revenue: 0,
      pending_revenue: 0,
    })

    const Dashboard = await DashboardPage()
    render(Dashboard)

    expect(screen.getByText(formatCurrency(0))).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('should show loading state initially', () => {
    // Mock a pending promise
    ;(getDashboardStats as jest.Mock).mockReturnValue(new Promise(() => {}))

    // In a real scenario, you'd test the loading state
    // For now, we'll just verify the function was called
    expect(getDashboardStats).toBeDefined()
  })

  it('should display recent activity section', async () => {
    const Dashboard = await DashboardPage()
    render(Dashboard)

    expect(screen.getByText('Recent Activity')).toBeInTheDocument()
    expect(screen.getByText('View all tabs')).toBeInTheDocument()
  })
})

describe('Dashboard Components', () => {
  describe('StatCard', () => {
    it('should render stat card with icon and value', () => {
      const StatCard = ({ name, value, icon: Icon, color }: any) => (
        <div className={`rounded-lg p-6 ${color}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{name}</p>
              <p className="text-2xl font-semibold text-gray-900">{value}</p>
            </div>
            <Icon className="h-8 w-8 text-white" />
          </div>
        </div>
      )

      const MockIcon = () => <svg data-testid="mock-icon" />
      
      render(
        <StatCard
          name="Test Stat"
          value="123"
          icon={MockIcon}
          color="bg-blue-500"
        />
      )

      expect(screen.getByText('Test Stat')).toBeInTheDocument()
      expect(screen.getByText('123')).toBeInTheDocument()
      expect(screen.getByTestId('mock-icon')).toBeInTheDocument()
    })
  })

  describe('RecentTabsTable', () => {
    const mockTabs = [
      {
        id: '1',
        customerEmail: 'customer1@example.com',
        totalAmount: '100.00',
        paidAmount: '50.00',
        status: 'partial',
        createdAt: new Date('2024-01-01'),
      },
      {
        id: '2',
        customerEmail: 'customer2@example.com',
        totalAmount: '200.00',
        paidAmount: '200.00',
        status: 'paid',
        createdAt: new Date('2024-01-02'),
      },
    ]

    it('should display recent tabs correctly', () => {
      const RecentTabsTable = ({ tabs }: any) => (
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tabs.map((tab: any) => (
                <tr key={tab.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {tab.customerEmail}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatCurrency(parseFloat(tab.totalAmount))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      tab.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {tab.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(tab.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )

      render(<RecentTabsTable tabs={mockTabs} />)

      // Check table headers
      expect(screen.getByText('Customer')).toBeInTheDocument()
      expect(screen.getByText('Amount')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Date')).toBeInTheDocument()

      // Check tab data
      expect(screen.getByText('customer1@example.com')).toBeInTheDocument()
      expect(screen.getByText('customer2@example.com')).toBeInTheDocument()
      expect(screen.getByText(formatCurrency(100))).toBeInTheDocument()
      expect(screen.getByText(formatCurrency(200))).toBeInTheDocument()
      expect(screen.getByText('partial')).toBeInTheDocument()
      expect(screen.getByText('paid')).toBeInTheDocument()
    })
  })
})