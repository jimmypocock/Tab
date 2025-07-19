'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'

interface Tab {
  id: string
  customerEmail: string
  customerName?: string
  total: string
  paidAmount: string
  status: 'paid' | 'partial' | 'open'
  currency: string
  createdAt: string
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

export function TabsList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tabs, setTabs] = useState<Tab[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [copiedTabId, setCopiedTabId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const fetchTabs = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      if (statusFilter) params.append('status', statusFilter)
      
      const page = searchParams.get('page') || '1'
      params.append('page', page)

      const response = await fetch(`/api/v1/tabs?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch tabs')
      }

      const result = await response.json()
      setTabs(result.data || [])
      if (result.pagination) {
        setPagination(result.pagination)
      }
    } catch (err) {
      setError('Error loading tabs')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [searchTerm, statusFilter, searchParams])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchTabs()
    }, searchTerm ? 300 : 0)

    return () => clearTimeout(timeoutId)
  }, [searchTerm, statusFilter, searchParams, fetchTabs, retryCount])

  const handleRetry = () => {
    setRetryCount(prev => prev + 1)
  }

  const handleCopyPaymentLink = async (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const link = `${origin}/pay/${tabId}`
    
    try {
      await navigator.clipboard.writeText(link)
      setCopiedTabId(tabId)
      setTimeout(() => setCopiedTabId(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleRowClick = (tabId: string) => {
    router.push(`/tabs/${tabId}`)
  }

  const handleStatusFilter = (status: string | null) => {
    setStatusFilter(status)
    const params = new URLSearchParams(searchParams)
    if (status) {
      params.set('status', status)
    } else {
      params.delete('status')
    }
    params.delete('page')
    router.push(`?${params.toString()}`)
  }

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', page.toString())
    router.push(`?${params.toString()}`)
  }

  const formatCurrency = (amount: string, currency: string = 'USD') => {
    const numAmount = parseFloat(amount)
    // Ensure currency is valid, default to USD if not
    const validCurrency = currency && currency.length === 3 ? currency : 'USD'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: validCurrency,
    }).format(numAmount)
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      paid: 'bg-green-100 text-green-800',
      partial: 'bg-yellow-100 text-yellow-800',
      open: 'bg-gray-100 text-gray-800',
    }
    return badges[status as keyof typeof badges] || badges.open
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={handleRetry}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (isLoading) {
    return <div className="text-center py-12">Loading...</div>
  }

  if (tabs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">No tabs found</p>
        <button
          onClick={() => router.push('/tabs/new')}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Create New Tab
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input
          type="text"
          placeholder="Search tabs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        
        <div className="flex gap-2">
          <button
            onClick={() => handleStatusFilter(null)}
            className={`px-4 py-2 rounded-md ${
              !statusFilter
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All
          </button>
          <button
            onClick={() => handleStatusFilter('paid')}
            className={`px-4 py-2 rounded-md ${
              statusFilter === 'paid'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Paid
          </button>
          <button
            onClick={() => handleStatusFilter('partial')}
            className={`px-4 py-2 rounded-md ${
              statusFilter === 'partial'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Partial
          </button>
          <button
            onClick={() => handleStatusFilter('open')}
            className={`px-4 py-2 rounded-md ${
              statusFilter === 'open'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Open
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
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
                Paid
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tabs.map((tab) => (
              <tr
                key={tab.id}
                onClick={() => handleRowClick(tab.id)}
                className="hover:bg-gray-50 cursor-pointer"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {tab.customerName || 'Unknown'}
                    </div>
                    <div className="text-sm text-gray-500">{tab.customerEmail}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" data-testid={`tab-total-${tab.id}`}>
                  {formatCurrency(tab.total, tab.currency)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" data-testid={`tab-paid-${tab.id}`}>
                  {formatCurrency(tab.paidAmount, tab.currency)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(
                      tab.status
                    )}`}
                    data-testid={`tab-status-${tab.id}`}
                  >
                    {tab.status.charAt(0).toUpperCase() + tab.status.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {format(new Date(tab.createdAt), 'MMM d, yyyy')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={(e) => handleCopyPaymentLink(tab.id, e)}
                    aria-label="Copy payment link"
                    className="text-blue-600 hover:text-blue-900 p-2"
                  >
                    {copiedTabId === tab.id ? (
                      <span className="text-green-600">Copied!</span>
                    ) : (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Page {pagination.page} of {pagination.totalPages}
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}