'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { CheckCircle, Loader2, Download, FileText } from 'lucide-react'
import Link from 'next/link'

interface BillingGroupReceipt {
  groupId: string
  groupName: string
  groupNumber: string
  amount: number
  items: Array<{
    description: string
    quantity: number
    unitPrice: string
    total: string
  }>
}

interface PaymentDetails {
  paymentId: string
  amount: number
  billingGroupAllocations?: Array<{
    billingGroupId: string
    amount: number
  }>
}

export default function EnhancedPaymentSuccessPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<any>(null)
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null)
  const [billingGroupReceipts, setBillingGroupReceipts] = useState<BillingGroupReceipt[]>([])

  const sessionId = searchParams.get('session_id')

  const fetchPaymentDetails = useCallback(async () => {
    if (!sessionId) return
    
    try {
      // In a real implementation, you'd have an API endpoint to get payment details from session
      // For now, we'll use the tab data to simulate receipts
      const response = await fetch(`/api/v1/public/tabs/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setTab(data.data)
        
        // If billing groups exist, create receipt data
        if (data.data.billingGroups && data.data.billingGroups.length > 0) {
          const receipts: BillingGroupReceipt[] = data.data.billingGroups.map((group: any) => {
            const groupItems = data.data.lineItems.filter((item: any) => 
              item.billingGroupId === group.id
            )
            const groupTotal = groupItems.reduce((sum: number, item: any) => 
              sum + parseFloat(item.total), 0
            )
            
            return {
              groupId: group.id,
              groupName: group.name,
              groupNumber: group.groupNumber,
              amount: groupTotal,
              items: groupItems,
            }
          })
          
          setBillingGroupReceipts(receipts)
        }
      }
    } catch (err) {
      console.error('Failed to fetch payment details:', err)
    } finally {
      setLoading(false)
    }
  }, [params.id, sessionId])

  useEffect(() => {
    fetchPaymentDetails()
  }, [fetchPaymentDetails])

  const downloadReceipt = async (groupId?: string) => {
    try {
      // Generate receipt URL based on whether it's for a specific group or entire payment
      const receiptUrl = groupId 
        ? `/api/v1/receipts/billing-group/${groupId}?payment_session=${sessionId}`
        : `/api/v1/receipts/payment/${sessionId}`
      
      const response = await fetch(receiptUrl)
      if (!response.ok) throw new Error('Failed to generate receipt')
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = groupId ? `receipt-${groupId}.pdf` : 'receipt.pdf'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Failed to download receipt:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  const hasBillingGroups = billingGroupReceipts.length > 0

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Success Header */}
          <div className="bg-green-50 px-6 py-8 text-center border-b border-green-100">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
            <p className="text-gray-600">Thank you for your payment.</p>
          </div>

          {/* Payment Summary */}
          <div className="px-6 py-6">
            {tab && (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h2 className="font-semibold text-gray-900 mb-3">Payment Summary</h2>
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
                      <span className="text-gray-500">Remaining Balance</span>
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

                {/* Billing Group Receipts */}
                {hasBillingGroups && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-gray-900">Download Receipts by Billing Group</h3>
                    
                    {/* Master Receipt */}
                    <div className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">Complete Payment Receipt</p>
                          <p className="text-sm text-gray-500">All billing groups combined</p>
                        </div>
                        <button
                          onClick={() => downloadReceipt()}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </button>
                      </div>
                    </div>

                    {/* Individual Group Receipts */}
                    {billingGroupReceipts.map((receipt) => (
                      <div key={receipt.groupId} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">{receipt.groupName}</p>
                            <p className="text-sm text-gray-500">
                              {receipt.items.length} items • ${receipt.amount.toFixed(2)}
                            </p>
                          </div>
                          <button
                            onClick={() => downloadReceipt(receipt.groupId)}
                            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Receipt
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-4 text-center text-sm text-gray-500">
                  A receipt has been sent to {tab.customerEmail}
                </div>

                {/* Actions */}
                <div className="pt-6 space-y-3">
                  {tab && parseFloat(tab.totalAmount) > parseFloat(tab.paidAmount) && (
                    <Link
                      href={`/pay/${params.id}`}
                      className="block w-full py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 text-center"
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
            )}
          </div>
        </div>
      </div>
    </div>
  )
}