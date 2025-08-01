'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Building2, Calendar, FileText, CreditCard, AlertCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/index'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface InvoicePaymentClientProps {
  invoice: any
  lineItems: any[]
  merchant: any
}

function InvoicePaymentForm({ invoice, lineItems, merchant }: InvoicePaymentClientProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payerEmail, setPayerEmail] = useState(invoice.customerEmail || '')
  const [payerName, setPayerName] = useState(invoice.customerName || '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      // Create payment intent
      const response = await fetch('/api/v1/public/invoice-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: invoice.id,
          publicUrl: invoice.publicUrl,
          amount: parseFloat(invoice.totalAmount) - parseFloat(invoice.paidAmount),
          currency: invoice.currency,
          customerEmail: payerEmail,
          customerName: payerName,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to create payment intent')
      }

      const { clientSecret } = await response.json()

      // Confirm payment
      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
          billing_details: {
            email: payerEmail,
            name: payerName,
          },
        },
      })

      if (confirmError) {
        throw confirmError
      }

      if (paymentIntent?.status === 'succeeded') {
        // Redirect to success page
        window.location.href = `/pay/invoice/${invoice.publicUrl}/success`
      } else {
        throw new Error('Payment was not successful')
      }
    } catch (err: any) {
      console.error('Payment error:', err)
      setError(err.message || 'An error occurred while processing your payment')
    } finally {
      setIsProcessing(false)
    }
  }

  const amountDue = parseFloat(invoice.totalAmount) - parseFloat(invoice.paidAmount)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Invoice #{invoice.invoiceNumber}</h1>
              <p className="mt-1 text-sm text-gray-600">
                From {merchant.name}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Amount Due</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(amountDue, invoice.currency)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Invoice Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Line Items */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Details</h2>
              
              <div className="space-y-4">
                {lineItems.map((item) => (
                  <div key={item.id} className="flex justify-between py-2 border-b border-gray-200 last:border-0">
                    <div>
                      <p className="font-medium text-gray-900">{item.description}</p>
                      {item.quantity > 1 && (
                        <p className="text-sm text-gray-600">
                          {item.quantity} × {formatCurrency(item.unitPrice, invoice.currency)}
                        </p>
                      )}
                    </div>
                    <p className="font-medium text-gray-900">
                      {formatCurrency(item.totalPrice, invoice.currency)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200 space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                </div>
                {invoice.taxAmount > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Tax</span>
                    <span>{formatCurrency(invoice.taxAmount, invoice.currency)}</span>
                  </div>
                )}
                {invoice.discountAmount > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(invoice.discountAmount, invoice.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-semibold text-gray-900 pt-2">
                  <span>Total</span>
                  <span>{formatCurrency(invoice.totalAmount, invoice.currency)}</span>
                </div>
                {invoice.paidAmount > 0 && (
                  <>
                    <div className="flex justify-between text-gray-600">
                      <span>Paid</span>
                      <span>-{formatCurrency(invoice.paidAmount, invoice.currency)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-semibold text-blue-600 pt-2">
                      <span>Amount Due</span>
                      <span>{formatCurrency(amountDue, invoice.currency)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Invoice Info */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Information</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Invoice Date</p>
                  <p className="font-medium text-gray-900">
                    {new Date(invoice.invoiceDate).toLocaleDateString()}
                  </p>
                </div>
                {invoice.dueDate && (
                  <div>
                    <p className="text-sm text-gray-600">Due Date</p>
                    <p className="font-medium text-gray-900">
                      {new Date(invoice.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {invoice.customerOrganizationName && (
                  <div>
                    <p className="text-sm text-gray-600">Bill To</p>
                    <p className="font-medium text-gray-900">{invoice.customerOrganizationName}</p>
                  </div>
                )}
                {invoice.reference && (
                  <div>
                    <p className="text-sm text-gray-600">Reference</p>
                    <p className="font-medium text-gray-900">{invoice.reference}</p>
                  </div>
                )}
              </div>

              {invoice.notes && (
                <div className="mt-4">
                  <p className="text-sm text-gray-600">Notes</p>
                  <p className="mt-1 text-gray-900">{invoice.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Payment Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Details</h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    required
                    value={payerEmail}
                    onChange={(e) => setPayerEmail(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    required
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Card Details
                  </label>
                  <div className="border border-gray-300 rounded-md p-3">
                    <CardElement
                      options={{
                        style: {
                          base: {
                            fontSize: '16px',
                            color: '#424770',
                            '::placeholder': {
                              color: '#aab7c4',
                            },
                          },
                          invalid: {
                            color: '#9e2146',
                          },
                        },
                      }}
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-md bg-red-50 p-4">
                    <div className="flex">
                      <AlertCircle className="h-5 w-5 text-red-400" />
                      <div className="ml-3">
                        <p className="text-sm text-red-800">{error}</p>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!stripe || isProcessing}
                  className={`w-full flex justify-center items-center px-4 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                    isProcessing
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-5 w-5 mr-2" />
                      Pay {formatCurrency(amountDue, invoice.currency)}
                    </>
                  )}
                </button>

                <p className="text-xs text-gray-500 text-center mt-4">
                  Powered by Stripe. Your payment information is secure and encrypted.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function InvoicePaymentClient(props: InvoicePaymentClientProps) {
  return (
    <Elements stripe={stripePromise}>
      <InvoicePaymentForm {...props} />
    </Elements>
  )
}