'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { CreditCard, Loader2, Shield } from 'lucide-react'

interface Tab {
  id: string
  customerEmail: string
  customerName?: string
  totalAmount: string
  paidAmount: string
  status: string
  lineItems: Array<{
    description: string
    quantity: number
    unitPrice: string
    total: string
  }>
  merchant: {
    businessName: string
  }
}

export default function PaymentPage() {
  const params = useParams()
  const [tab, setTab] = useState<Tab | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [amount, setAmount] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchTab()
  }, [params.id])

  const fetchTab = async () => {
    try {
      const response = await fetch(`/api/v1/public/tabs/${params.id}`)
      if (!response.ok) {
        throw new Error('Tab not found')
      }
      const data = await response.json()
      setTab(data.data)
      setEmail(data.data.customerEmail)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePayment = async () => {
    if (!tab || !email) return

    setProcessing(true)
    setError(null)

    try {
      const balance = parseFloat(tab.totalAmount) - parseFloat(tab.paidAmount)
      const paymentAmount = amount ? parseFloat(amount) : balance

      if (paymentAmount <= 0 || paymentAmount > balance) {
        setError('Invalid payment amount')
        setProcessing(false)
        return
      }

      // Create checkout session
      const response = await fetch('/api/v1/public/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tabId: tab.id,
          amount: paymentAmount,
          email,
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

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        {/* Merchant Info */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{tab.merchant.businessName}</h1>
          <p className="mt-2 text-gray-600">Payment Request</p>
        </div>

        {/* Tab Details */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Tab Details</h2>
          </div>
          
          <div className="px-6 py-4 space-y-3">
            {tab.lineItems.map((item, index) => (
              <div key={index} className="flex justify-between text-sm">
                <div>
                  <p className="font-medium text-gray-900">{item.description}</p>
                  <p className="text-gray-500">Qty: {item.quantity}</p>
                </div>
                <p className="font-medium text-gray-900">${parseFloat(item.total).toFixed(2)}</p>
              </div>
            ))}
          </div>
          
          <div className="px-6 py-4 border-t border-gray-200 space-y-2">
            <div className="flex justify-between text-sm">
              <p className="text-gray-500">Total</p>
              <p className="font-medium text-gray-900">${parseFloat(tab.totalAmount).toFixed(2)}</p>
            </div>
            <div className="flex justify-between text-sm">
              <p className="text-gray-500">Paid</p>
              <p className="font-medium text-gray-900">${parseFloat(tab.paidAmount).toFixed(2)}</p>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <p className="text-gray-900">Balance Due</p>
              <p className="text-gray-900">${balance.toFixed(2)}</p>
            </div>
          </div>
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

            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                Payment Amount (optional)
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  id="amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={balance.toFixed(2)}
                  step="0.01"
                  min="0.01"
                  max={balance}
                  className="pl-7 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Leave blank to pay full balance of ${balance.toFixed(2)}
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
              disabled={!email || processing}
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
                  Pay with Card
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
            You will be redirected to Stripe's secure checkout page.
            We never see or store your card information.
          </p>
        </div>
      </div>
    </div>
  )
}