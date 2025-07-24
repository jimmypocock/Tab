'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Copy, Mail, ArrowLeft, ExternalLink } from 'lucide-react'
import { SendInvoiceModal } from './send-invoice-modal'
import { useToast } from '@/lib/toast/toast-context'
import { BillingGroupsManager } from '@/components/dashboard/billing-groups'

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const { showToast } = useToast()

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    showToast({
      type: 'success',
      title: 'Copied to clipboard',
      duration: 2000,
    })
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
    >
      <Copy className="h-4 w-4" />
      {copied && <span className="ml-2">Copied!</span>}
    </button>
  )
}

interface SendInvoiceButtonProps {
  tabId: string
  customerEmail: string
  customerName?: string
}

export function SendInvoiceButton({ tabId, customerEmail, customerName }: SendInvoiceButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { showToast } = useToast()

  const handleSendInvoice = async (emails: string[]) => {
    try {
      const response = await fetch(`/api/tabs/${tabId}/invoice?send=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          recipientEmail: emails[0], // Primary recipient
          ccEmails: emails.slice(1)  // Additional recipients
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invoice')
      }

      showToast({
        type: 'success',
        title: 'Invoice sent successfully!',
        description: `Sent to ${emails.length} recipient${emails.length > 1 ? 's' : ''}`,
      })
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Failed to send invoice',
        description: error.message,
      })
      throw error // Re-throw so modal handles it
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        <Mail className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
        Send Invoice
      </button>

      <SendInvoiceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        tabId={tabId}
        defaultEmail={customerEmail}
        customerName={customerName}
        onSend={handleSendInvoice}
      />
    </>
  )
}

interface TabDetailsClientProps {
  tab: any
  billingGroups: any[]
  lineItems: any[]
  payments: any[]
  paymentUrl: string
  balance: number
}

export function TabDetailsClient({
  tab,
  billingGroups,
  lineItems,
  payments,
  paymentUrl,
  balance
}: TabDetailsClientProps) {
  const [refreshKey, setRefreshKey] = useState(0)

  const handleBillingGroupsUpdate = () => {
    setRefreshKey(prev => prev + 1)
    // In a real app, you'd refetch the data here
    window.location.reload()
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/tabs"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Tabs
        </Link>
        
        <div className="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Tab Details</h1>
            <p className="mt-1 text-sm text-gray-500">
              ID: {tab.id}
            </p>
          </div>
          <div className="mt-3 sm:mt-0 sm:ml-4 flex gap-3">
            <Link
              href={paymentUrl}
              target="_blank"
              className="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              <ExternalLink className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
              View Payment Page
            </Link>
            <SendInvoiceButton 
              tabId={tab.id} 
              customerEmail={tab.customer_email}
              customerName={tab.customer_name}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Info */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Customer Information
              </h3>
            </div>
            <div className="px-4 py-5 sm:p-6">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {tab.customer_name || 'Not provided'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Email</dt>
                  <dd className="mt-1 text-sm text-gray-900">{tab.customer_email}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">External Reference</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {tab.external_reference || 'None'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(tab.created_at).toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Billing Groups Manager */}
          <BillingGroupsManager
            tab={tab}
            billingGroups={billingGroups}
            lineItems={lineItems}
            onUpdate={handleBillingGroupsUpdate}
          />

          {/* Line Items */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Line Items
              </h3>
            </div>
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Qty
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Unit Price
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Group
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {lineItems.map((item: any) => {
                    const assignedGroup = billingGroups.find(g => g.id === item.billing_group_id)
                    return (
                      <tr key={item.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.description}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ${parseFloat(item.unit_price).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          ${parseFloat(item.total).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {assignedGroup ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {assignedGroup.name}
                            </span>
                          ) : (
                            <span className="text-gray-400">Unassigned</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment History */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Payment History
              </h3>
            </div>
            <div className="overflow-hidden">
              {payments.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Transaction ID
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {payments.map((payment: any) => (
                      <tr key={payment.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(payment.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${parseFloat(payment.amount).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            payment.status === 'succeeded' 
                              ? 'bg-green-100 text-green-800'
                              : payment.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {payment.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {payment.processor_payment_id?.slice(0, 20)}...
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No payments yet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Tab Summary */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Summary
              </h3>
            </div>
            <div className="px-4 py-5 sm:p-6">
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1">
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
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Subtotal</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    ${parseFloat(tab.subtotal).toFixed(2)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Tax</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    ${parseFloat(tab.tax_amount).toFixed(2)}
                  </dd>
                </div>
                <div className="pt-4 border-t">
                  <dt className="text-sm font-medium text-gray-500">Total</dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900">
                    ${parseFloat(tab.total_amount).toFixed(2)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Paid</dt>
                  <dd className="mt-1 text-lg font-semibold text-green-600">
                    ${parseFloat(tab.paid_amount).toFixed(2)}
                  </dd>
                </div>
                <div className="pt-4 border-t">
                  <dt className="text-sm font-medium text-gray-500">Balance</dt>
                  <dd className="mt-1 text-lg font-semibold text-gray-900">
                    ${balance.toFixed(2)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Payment Link */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Payment Link
              </h3>
            </div>
            <div className="px-4 py-5 sm:p-6">
              <p className="text-sm text-gray-500 mb-3">
                Share this link with your customer:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={paymentUrl}
                  className="flex-1 text-sm bg-gray-50 border border-gray-300 rounded-md px-3 py-2"
                />
                <CopyButton text={paymentUrl} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}