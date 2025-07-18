'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { CheckCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function PaymentSuccessPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<any>(null)

  useEffect(() => {
    // Fetch the updated tab to show current status
    fetchTab()
  }, [params.id])

  const fetchTab = async () => {
    try {
      const response = await fetch(`/api/v1/public/tabs/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setTab(data.data)
      }
    } catch (err) {
      console.error('Failed to fetch tab:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
        <p className="text-gray-600 mb-6">Thank you for your payment.</p>
        
        {tab && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Merchant</span>
                <span className="font-medium">{tab.merchant.businessName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total Paid</span>
                <span className="font-medium">${parseFloat(tab.paidAmount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Balance</span>
                <span className="font-medium">
                  ${(parseFloat(tab.totalAmount) - parseFloat(tab.paidAmount)).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className={`font-medium ${
                  tab.status === 'paid' ? 'text-green-600' : 'text-blue-600'
                }`}>
                  {tab.status === 'paid' ? 'Paid in Full' : 'Partial Payment'}
                </span>
              </div>
            </div>
          </div>
        )}
        
        <p className="text-sm text-gray-500 mb-6">
          A receipt has been sent to {tab?.customerEmail || 'your email address'}.
        </p>
        
        <div className="space-y-3">
          {tab && parseFloat(tab.totalAmount) > parseFloat(tab.paidAmount) && (
            <Link
              href={`/pay/${params.id}`}
              className="block w-full py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Make Another Payment
            </Link>
          )}
          
          <button
            onClick={() => window.close()}
            className="block w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  )
}