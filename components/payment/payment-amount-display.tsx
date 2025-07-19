import React from 'react'
import { cn } from '@/lib/utils'

interface PaymentAmountDisplayProps {
  total: number | string
  paid: number | string
  currency?: string
  className?: string
  showBalance?: boolean
}

export function PaymentAmountDisplay({ 
  total, 
  paid, 
  currency = 'USD',
  className,
  showBalance = true 
}: PaymentAmountDisplayProps) {
  const totalAmount = typeof total === 'string' ? parseFloat(total) : total
  const paidAmount = typeof paid === 'string' ? parseFloat(paid) : paid
  const balance = totalAmount - paidAmount
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount)
  }
  
  const isPaid = balance <= 0
  const isPartial = paidAmount > 0 && balance > 0
  
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Total</span>
        <span className="font-medium text-gray-900" data-testid="payment-total">
          {formatCurrency(totalAmount)}
        </span>
      </div>
      
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">Paid</span>
        <span 
          className={cn(
            'font-medium',
            isPaid ? 'text-green-600' : isPartial ? 'text-blue-600' : 'text-gray-900'
          )}
          data-testid="payment-paid"
        >
          {formatCurrency(paidAmount)}
        </span>
      </div>
      
      {showBalance && balance > 0 && (
        <>
          <div className="border-t pt-2" />
          <div className="flex justify-between">
            <span className="font-medium text-gray-900">Balance Due</span>
            <span className="font-semibold text-gray-900" data-testid="payment-balance">
              {formatCurrency(balance)}
            </span>
          </div>
        </>
      )}
    </div>
  )
}