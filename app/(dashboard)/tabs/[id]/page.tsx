import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { CopyButton, SendInvoiceButton } from './client-components'

export default async function TabDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  
  // Await params in Next.js 15
  const { id } = await params
  
  const { data: { user } } = await supabase.auth.getUser()
  
  // Fetch tab with all related data
  const { data: tab } = await supabase
    .from('tabs')
    .select(`
      *,
      line_items (*),
      payments (*),
      invoices (*),
      merchant:merchants (*)
    `)
    .eq('id', id)
    .eq('merchant_id', user!.id)
    .single()

  if (!tab) {
    notFound()
  }

  const balance = parseFloat(tab.total_amount) - parseFloat(tab.paid_amount)
  const paymentUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pay/${tab.id}`

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
            <SendInvoiceButton tabId={tab.id} />
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
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tab.line_items.map((item: any) => (
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
                    </tr>
                  ))}
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
              {tab.payments.length > 0 ? (
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
                    {tab.payments.map((payment: any) => (
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