import React from 'react'
import { Badge } from '@/components/ui'

export type PaymentStatus = 'paid' | 'partial' | 'open' | 'disputed' | 'refunded' | 'failed'

interface PaymentStatusBadgeProps {
  status: PaymentStatus
  className?: string
}

const statusConfig: Record<PaymentStatus, { variant: 'success' | 'warning' | 'default' | 'danger', label: string }> = {
  paid: { variant: 'success', label: 'Paid' },
  partial: { variant: 'warning', label: 'Partial' },
  open: { variant: 'default', label: 'Open' },
  disputed: { variant: 'danger', label: 'Disputed' },
  refunded: { variant: 'warning', label: 'Refunded' },
  failed: { variant: 'danger', label: 'Failed' },
}

export function PaymentStatusBadge({ status, className }: PaymentStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.open
  
  return (
    <Badge 
      variant={config.variant} 
      className={className}
      data-testid={`payment-status-${status}`}
    >
      {config.label}
    </Badge>
  )
}