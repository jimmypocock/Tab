'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { CreditCard, Loader2, Shield, ChevronDown, ChevronUp, Users, User } from 'lucide-react'

interface LineItem {
  id: string
  description: string
  quantity: number
  unitPrice: string
  total: string
  billingGroupId?: string | null
}

interface BillingGroup {
  id: string
  name: string
  groupNumber: string
  groupType: string
  payerEmail?: string | null
  currentBalance: string
  depositAmount?: string | null
  depositApplied?: string | null
}

interface Tab {
  id: string
  customerEmail: string
  customerName?: string
  totalAmount: string
  paidAmount: string
  status: string
  lineItems: LineItem[]
  billingGroups?: BillingGroup[]
  merchant: {
    businessName: string
  }
}

interface GroupSummary {
  groupId: string
  name: string
  groupNumber: string
  payerEmail?: string | null
  items: LineItem[]
  subtotal: number
  balance: number
}

export default function EnhancedPaymentPage() {
  const params = useParams()
  const [tab, setTab] = useState<Tab | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [customAmount, setCustomAmount] = useState('')
  const [processing, setProcessing] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<string[]>([])

  const fetchTab = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/public/tabs/${params.id}`)
      if (!response.ok) {
        throw new Error('Tab not found')
      }
      const data = await response.json()
      setTab(data.data)
      setEmail(data.data.customerEmail)
      
      // If billing groups exist, select all by default
      if (data.data.billingGroups && data.data.billingGroups.length > 0) {
        setSelectedGroups(data.data.billingGroups.map((g: BillingGroup) => g.id))
        setExpandedGroups(data.data.billingGroups.map((g: BillingGroup) => g.id))
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    fetchTab()
  }, [fetchTab])

  // Calculate billing group summaries
  const groupSummaries = useMemo(() => {
    if (!tab) return []
    
    const summaries: GroupSummary[] = []
    
    if (tab.billingGroups && tab.billingGroups.length > 0) {
      // Group items by billing group
      for (const group of tab.billingGroups) {
        const groupItems = tab.lineItems.filter(item => item.billingGroupId === group.id)
        const subtotal = groupItems.reduce((sum, item) => sum + parseFloat(item.total), 0)
        
        summaries.push({
          groupId: group.id,
          name: group.name,
          groupNumber: group.groupNumber,
          payerEmail: group.payerEmail,
          items: groupItems,
          subtotal,
          balance: parseFloat(group.currentBalance),
        })
      }
      
      // Add unassigned items as a special group
      const unassignedItems = tab.lineItems.filter(item => !item.billingGroupId)
      if (unassignedItems.length > 0) {
        const subtotal = unassignedItems.reduce((sum, item) => sum + parseFloat(item.total), 0)
        summaries.push({
          groupId: 'unassigned',
          name: 'Unassigned Charges',
          groupNumber: 'MISC',
          items: unassignedItems,
          subtotal,
          balance: subtotal,
        })
      }
    } else {
      // No billing groups - show all items as one group
      const subtotal = tab.lineItems.reduce((sum, item) => sum + parseFloat(item.total), 0)
      summaries.push({
        groupId: 'all',
        name: 'All Charges',
        groupNumber: 'TAB',
        items: tab.lineItems,
        subtotal,
        balance: parseFloat(tab.totalAmount) - parseFloat(tab.paidAmount),
      })
    }
    
    return summaries
  }, [tab])

  // Calculate selected amount
  const selectedAmount = useMemo(() => {
    return groupSummaries
      .filter(g => selectedGroups.includes(g.groupId))
      .reduce((sum, g) => sum + g.balance, 0)
  }, [groupSummaries, selectedGroups])

  const toggleGroup = (groupId: string) => {
    setSelectedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    )
  }

  const toggleExpanded = (groupId: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    )
  }

  const handlePayment = async () => {
    if (!tab || !email) return

    setProcessing(true)
    setError(null)

    try {
      const paymentAmount = customAmount ? parseFloat(customAmount) : selectedAmount

      if (paymentAmount <= 0) {
        setError('Please select at least one billing group or enter a custom amount')
        setProcessing(false)
        return
      }

      const balance = parseFloat(tab.totalAmount) - parseFloat(tab.paidAmount)
      if (paymentAmount > balance) {
        setError('Payment amount exceeds balance due')
        setProcessing(false)
        return
      }

      // Create checkout session with billing group information
      const response = await fetch('/api/v1/public/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tabId: tab.id,
          amount: paymentAmount,
          email,
          billingGroupIds: selectedGroups.filter(id => id !== 'all' && id !== 'unassigned'),
          metadata: {
            selectedGroups: selectedGroups.join(','),
            paymentType: customAmount ? 'custom' : 'billing-groups'
          }
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create payment session')
      }

      const { data } = await response.json()

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('No checkout URL received')
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error || !tab) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Tab Not Found</h1>
          <p className="text-gray-600">{error || 'The payment link you followed is invalid.'}</p>
        </div>
      </div>
    )
  }

  const balance = parseFloat(tab.totalAmount) - parseFloat(tab.paidAmount)

  if (balance <= 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Tab Paid</h1>
          <p className="text-gray-600">This tab has already been paid in full.</p>
        </div>
      </div>
    )
  }

  const hasBillingGroups = tab.billingGroups && tab.billingGroups.length > 0

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Merchant Info */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{tab.merchant.businessName}</h1>
          <p className="mt-2 text-gray-600">Payment Request</p>
        </div>

        {/* Tab Summary */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">Tab Summary</h2>
              <span className="text-sm text-gray-500">Tab #{tab.id.slice(-8)}</span>
            </div>
          </div>
          
          <div className="px-6 py-4 space-y-2">
            <div className="flex justify-between text-sm">
              <p className="text-gray-500">Total Charges</p>
              <p className="font-medium text-gray-900">${parseFloat(tab.totalAmount).toFixed(2)}</p>
            </div>
            <div className="flex justify-between text-sm">
              <p className="text-gray-500">Amount Paid</p>
              <p className="font-medium text-gray-900">${parseFloat(tab.paidAmount).toFixed(2)}</p>
            </div>
            <div className="flex justify-between text-base font-semibold pt-2 border-t">
              <p className="text-gray-900">Balance Due</p>
              <p className="text-gray-900">${balance.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Billing Groups or Line Items */}
        <div className="space-y-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            {hasBillingGroups ? 'Select Billing Groups to Pay' : 'Charges'}
          </h3>
          
          {groupSummaries.map((group) => (
            <div 
              key={group.groupId} 
              className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      {hasBillingGroups && (
                        <input
                          type="checkbox"
                          id={`group-${group.groupId}`}
                          checked={selectedGroups.includes(group.groupId)}
                          onChange={() => toggleGroup(group.groupId)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-3"
                        />
                      )}
                      <label 
                        htmlFor={`group-${group.groupId}`}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-base font-medium text-gray-900">
                              {group.name}
                            </h4>
                            {group.payerEmail && (
                              <p className="text-sm text-gray-500 flex items-center mt-1">
                                <User className="h-3 w-3 mr-1" />
                                {group.payerEmail}
                              </p>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-base font-semibold text-gray-900">
                              ${group.balance.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {group.items.length} item{group.items.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleExpanded(group.groupId)}
                    className="ml-4 text-gray-400 hover:text-gray-600"
                  >
                    {expandedGroups.includes(group.groupId) ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </button>
                </div>
                
                {expandedGroups.includes(group.groupId) && (
                  <div className="mt-4 space-y-2 pl-7 border-t pt-3">
                    {group.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <div>
                          <p className="text-gray-700">{item.description}</p>
                          <p className="text-gray-500">Qty: {item.quantity} × ${parseFloat(item.unitPrice).toFixed(2)}</p>
                        </div>
                        <p className="text-gray-700">${parseFloat(item.total).toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Payment Form */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
            </div>

            {hasBillingGroups && (
              <div className="bg-blue-50 rounded-md p-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium text-blue-900">
                    Selected Amount
                  </p>
                  <p className="text-lg font-semibold text-blue-900">
                    ${selectedAmount.toFixed(2)}
                  </p>
                </div>
                {selectedGroups.length === 0 && (
                  <p className="text-xs text-blue-700 mt-1">
                    Select billing groups above or enter a custom amount
                  </p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                Custom Payment Amount (optional)
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  id="amount"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder={hasBillingGroups ? "Override selected amount" : balance.toFixed(2)}
                  step="0.01"
                  min="0.01"
                  max={balance}
                  className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {hasBillingGroups 
                  ? "Enter an amount to override billing group selection"
                  : `Leave blank to pay full balance of $${balance.toFixed(2)}`}
              </p>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <button
              type="button"
              onClick={handlePayment}
              disabled={!email || processing || (!customAmount && selectedGroups.length === 0 && hasBillingGroups)}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" />
                  Redirecting to payment...
                </>
              ) : (
                <>
                  <CreditCard className="-ml-1 mr-2 h-5 w-5" />
                  Pay {customAmount ? `$${parseFloat(customAmount).toFixed(2)}` : `$${selectedAmount.toFixed(2)}`}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-6 text-center space-y-2">
          <div className="flex items-center justify-center text-sm text-gray-500">
            <Shield className="h-4 w-4 mr-1" />
            <span>Secure payment via Stripe</span>
          </div>
          <p className="text-xs text-gray-500">
            You will be redirected to Stripe&apos;s secure checkout page.
            We never see or store your card information.
          </p>
        </div>
      </div>
    </div>
  )
}