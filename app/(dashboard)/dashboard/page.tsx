import { createClient } from '@/lib/supabase/server'
import { DollarSign, FileText, Clock, CheckCircle } from 'lucide-react'
import { getDashboardStats, getRecentTabs } from '@/lib/services/dashboard'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  // Get stats and recent tabs in parallel with caching
  const [stats, recentTabs] = await Promise.all([
    getDashboardStats(user!.id),
    getRecentTabs(user!.id, 5),
  ])

  const statCards = [
    {
      name: 'Total Revenue',
      value: `$${(stats?.total_revenue || 0).toFixed(2)}`,
      icon: DollarSign,
      color: 'bg-green-500',
    },
    {
      name: 'Pending Revenue',
      value: `$${(stats?.pending_revenue || 0).toFixed(2)}`,
      icon: Clock,
      color: 'bg-yellow-500',
    },
    {
      name: 'Total Tabs',
      value: stats?.total_tabs || 0,
      icon: FileText,
      color: 'bg-blue-500',
    },
    {
      name: 'Open Tabs',
      value: stats?.open_tabs || 0,
      icon: CheckCircle,
      color: 'bg-purple-500',
    },
  ]

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {statCards.map((stat) => (
          <div
            key={stat.name}
            className="relative overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:px-6 sm:py-6"
          >
            <dt>
              <div className={`absolute rounded-md p-3 ${stat.color}`}>
                <stat.icon className="h-6 w-6 text-white" aria-hidden="true" />
              </div>
              <p className="ml-16 truncate text-sm font-medium text-gray-500">
                {stat.name}
              </p>
            </dt>
            <dd className="ml-16 flex items-baseline">
              <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
            </dd>
          </div>
        ))}
      </div>

      {/* Recent Tabs */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Recent Tabs
          </h3>
        </div>
        <div className="overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentTabs?.map((tab) => (
                <tr key={tab.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {tab.customerName || tab.customerEmail}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${parseFloat(tab.totalAmount).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      tab.status === 'paid' 
                        ? 'bg-green-100 text-green-800'
                        : tab.status === 'partial'
                        ? 'bg-yellow-100 text-yellow-800'
                        : tab.status === 'open'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {tab.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(tab.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!recentTabs || recentTabs.length === 0) && (
            <div className="text-center py-8 text-gray-500">
              No tabs yet. Create your first tab to get started!
            </div>
          )}
        </div>
      </div>
    </div>
  )
}