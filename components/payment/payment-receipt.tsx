'use client'

import React from 'react'
import type { PaymentStatus } from './payment-status-badge'

interface LineItem {
  description: string
  quantity: number
  amount: number
}

interface PaymentReceiptProps {
  merchantName: string
  merchantAddress?: string
  paymentId: string
  invoiceNumber?: string
  customerName: string
  customerEmail: string
  paymentDate: Date
  lineItems?: LineItem[]
  subtotal: number
  tax?: number
  total: number
  amountPaid: number
  paymentMethod?: string
  status: PaymentStatus
  notes?: string
  className?: string
}

export function PaymentReceipt({
  merchantName,
  merchantAddress,
  paymentId,
  invoiceNumber,
  customerName,
  customerEmail,
  paymentDate,
  lineItems = [],
  subtotal,
  tax = 0,
  total,
  amountPaid,
  paymentMethod = 'Credit Card',
  status,
  notes,
  className
}: PaymentReceiptProps) {
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long'
  }).format(paymentDate)
  
  return (
    <div className={`bg-white p-8 ${className}`} data-testid="payment-receipt">
      {/* Header */}
      <div className="border-b pb-6 mb-6">
        <h1 className="text-2xl font-bold mb-2">Payment Receipt</h1>
        <div className="flex justify-between text-sm">
          <div>
            <p className="font-semibold">{merchantName}</p>
            {merchantAddress && (
              <p className="text-gray-600 whitespace-pre-line">{merchantAddress}</p>
            )}
          </div>
          <div className="text-right">
            <p>Receipt #{paymentId}</p>
            {invoiceNumber && <p>Invoice #{invoiceNumber}</p>}
            <p>{formattedDate}</p>
          </div>
        </div>
      </div>
      
      {/* Customer Info */}
      <div className="mb-6">
        <h2 className="font-semibold mb-2">Bill To:</h2>
        <p>{customerName}</p>
        <p className="text-gray-600">{customerEmail}</p>
      </div>
      
      {/* Line Items */}
      {lineItems.length > 0 && (
        <div className="mb-6">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Description</th>
                <th className="text-right py-2">Qty</th>
                <th className="text-right py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, index) => (
                <tr key={index} className="border-b">
                  <td className="py-2">{item.description}</td>
                  <td className="text-right py-2">{item.quantity}</td>
                  <td className="text-right py-2">
                    ${(item.amount / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Totals */}
      <div className="mb-6">
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>${(subtotal / 100).toFixed(2)}</span>
          </div>
          {tax > 0 && (
            <div className="flex justify-between">
              <span>Tax</span>
              <span>${(tax / 100).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-lg border-t pt-1">
            <span>Total</span>
            <span>${(total / 100).toFixed(2)}</span>
          </div>
        </div>
      </div>
      
      {/* Payment Info */}
      <div className="mb-6 p-4 bg-gray-50 rounded">
        <h3 className="font-semibold mb-2">Payment Information</h3>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Payment Method</span>
            <span>{paymentMethod}</span>
          </div>
          <div className="flex justify-between">
            <span>Amount Paid</span>
            <span className="font-semibold">${(amountPaid / 100).toFixed(2)}</span>
          </div>
          {status === 'partial' && (
            <div className="flex justify-between text-orange-600">
              <span>Balance Due</span>
              <span className="font-semibold">
                ${((total - amountPaid) / 100).toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>
      
      {/* Notes */}
      {notes && (
        <div className="mb-6">
          <h3 className="font-semibold mb-2">Notes</h3>
          <p className="text-sm text-gray-600">{notes}</p>
        </div>
      )}
      
      {/* Footer */}
      <div className="text-center text-sm text-gray-600 border-t pt-6">
        <p>Thank you for your payment!</p>
        <p className="mt-2">
          This receipt was generated electronically and is valid without a signature.
        </p>
      </div>
    </div>
  )
}