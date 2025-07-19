'use client'

import React from 'react'
import { CheckCircle, Download, Mail, Printer } from 'lucide-react'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui'
import { Button } from '@/components/ui'
import { PaymentStatusBadge } from './payment-status-badge'
import { PaymentAmountDisplay } from './payment-amount-display'
import type { PaymentStatus } from './payment-status-badge'

interface PaymentSuccessCardProps {
  merchantName: string
  paymentId: string
  amount: number | string
  total: number | string
  status: PaymentStatus
  customerEmail?: string
  paymentDate?: Date
  onPrint?: () => void
  onDownload?: () => void
  onResendEmail?: () => void
  className?: string
}

export function PaymentSuccessCard({
  merchantName,
  paymentId,
  amount,
  total,
  status,
  customerEmail,
  paymentDate = new Date(),
  onPrint,
  onDownload,
  onResendEmail,
  className
}: PaymentSuccessCardProps) {
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(paymentDate)
  
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div>
              <h2 className="text-xl font-semibold">Payment Successful</h2>
              <p className="text-sm text-gray-600">Transaction #{paymentId}</p>
            </div>
          </div>
          <PaymentStatusBadge status={status} />
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600">Paid to</p>
            <p className="font-medium">{merchantName}</p>
          </div>
          
          <div>
            <p className="text-sm text-gray-600">Payment date</p>
            <p className="font-medium">{formattedDate}</p>
          </div>
          
          <PaymentAmountDisplay
            total={total}
            paid={amount}
            showBalance={status === 'partial'}
          />
          
          {customerEmail && (
            <div className="pt-2 border-t">
              <p className="text-sm text-gray-600">
                Receipt sent to: <span className="font-medium">{customerEmail}</span>
              </p>
            </div>
          )}
        </div>
      </CardContent>
      
      {(onPrint || onDownload || onResendEmail) && (
        <CardFooter>
          <div className="flex gap-2 w-full">
            {onPrint && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onPrint}
                className="flex-1"
              >
                <Printer className="h-4 w-4 mr-1" />
                Print
              </Button>
            )}
            {onDownload && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onDownload}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
            )}
            {onResendEmail && customerEmail && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onResendEmail}
                className="flex-1"
              >
                <Mail className="h-4 w-4 mr-1" />
                Resend
              </Button>
            )}
          </div>
        </CardFooter>
      )}
    </Card>
  )
}