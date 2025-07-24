'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Building2, CreditCard, DollarSign, User, Package } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BillingGroupSummary {
  billing_group: {
    id: string
    name: string
    type: string
    status: string
    payer_email?: string
    payer_organization_id?: string
    credit_limit?: number | null
    current_balance: number
    deposit_amount?: number
    deposit_applied?: number
  }
  line_items_count: number
  total: number
  deposit_remaining?: number
}

interface BillingSummaryProps {
  groups: BillingGroupSummary[]
  unassignedItems: Array<{
    id: string
    description: string
    quantity: number
    unit_price: number
    total: number
  }>
  totalAmount: number
  paymentMode?: 'full' | 'group'
  selectedGroupId?: string
}

export function BillingSummary({
  groups,
  unassignedItems,
  totalAmount,
  paymentMode = 'full',
  selectedGroupId
}: BillingSummaryProps) {
  const getGroupIcon = (type: string) => {
    switch (type) {
      case 'corporate':
        return <Building2 className="h-4 w-4" />
      case 'deposit':
        return <DollarSign className="h-4 w-4" />
      case 'credit':
        return <CreditCard className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  const getGroupTypeColor = (type: string) => {
    switch (type) {
      case 'corporate':
        return 'bg-blue-500/10 text-blue-700 border-blue-200'
      case 'deposit':
        return 'bg-green-500/10 text-green-700 border-green-200'
      case 'credit':
        return 'bg-purple-500/10 text-purple-700 border-purple-200'
      default:
        return 'bg-gray-500/10 text-gray-700 border-gray-200'
    }
  }

  const renderGroupSummary = (group: BillingGroupSummary) => {
    const isSelected = paymentMode === 'group' && selectedGroupId === group.billing_group.id
    const creditUsage = group.billing_group.credit_limit 
      ? (group.billing_group.current_balance / group.billing_group.credit_limit) * 100 
      : 0

    return (
      <Card 
        key={group.billing_group.id}
        className={cn(
          "transition-all",
          isSelected && "ring-2 ring-primary"
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-medium">
                {group.billing_group.name}
              </CardTitle>
              <Badge variant="outline" className={cn("text-xs", getGroupTypeColor(group.billing_group.type))}>
                {getGroupIcon(group.billing_group.type)}
                <span className="ml-1">{group.billing_group.type}</span>
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold">${group.total.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">
                {group.line_items_count} item{group.line_items_count !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Payer Info */}
          {group.billing_group.payer_email && (
            <div className="text-sm">
              <span className="text-muted-foreground">Payer:</span>{' '}
              <span className="font-medium">{group.billing_group.payer_email}</span>
            </div>
          )}

          {/* Deposit Info */}
          {group.billing_group.deposit_amount && group.billing_group.deposit_amount > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Deposit Available</span>
                <span className="font-medium">
                  ${(group.deposit_remaining || 0).toFixed(2)}
                </span>
              </div>
              <Progress 
                value={(group.billing_group.deposit_applied || 0) / group.billing_group.deposit_amount * 100} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground">
                ${group.billing_group.deposit_applied || 0} of ${group.billing_group.deposit_amount} used
              </p>
            </div>
          )}

          {/* Credit Info */}
          {group.billing_group.credit_limit && group.billing_group.credit_limit > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Credit Available</span>
                <span className="font-medium">
                  ${(group.billing_group.credit_limit - group.billing_group.current_balance).toFixed(2)}
                </span>
              </div>
              <Progress 
                value={creditUsage} 
                className={cn(
                  "h-2",
                  creditUsage > 90 && "bg-red-100 [&>div]:bg-red-500",
                  creditUsage > 75 && creditUsage <= 90 && "bg-yellow-100 [&>div]:bg-yellow-500"
                )}
              />
              <p className="text-xs text-muted-foreground">
                ${group.billing_group.current_balance} of ${group.billing_group.credit_limit} used
              </p>
            </div>
          )}

          {/* Payment Status */}
          {paymentMode === 'group' && isSelected && (
            <div className="pt-2 border-t">
              <Badge className="w-full justify-center">
                Selected for Payment
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">Billing Summary</h2>
        <p className="text-muted-foreground">
          Review charges before proceeding to payment
        </p>
      </div>

      {/* Total Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium">Total Amount</span>
            <span className="text-2xl font-bold">${totalAmount.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Billing Groups */}
      {groups.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Billing Groups</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {groups.map(renderGroupSummary)}
          </div>
        </div>
      )}

      {/* Unassigned Items */}
      {unassignedItems.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-medium">Unassigned Items</h3>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {unassignedItems.map((item) => (
                  <div key={item.id} className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} × ${item.unit_price.toFixed(2)}
                      </p>
                    </div>
                    <span className="text-sm font-medium">
                      ${item.total.toFixed(2)}
                    </span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between items-center pt-2">
                  <span className="text-sm font-medium">Subtotal</span>
                  <span className="text-sm font-semibold">
                    ${unassignedItems.reduce((sum, item) => sum + item.total, 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payment Instructions */}
      {paymentMode === 'group' && selectedGroupId && (
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <p className="text-sm text-center text-muted-foreground">
              You are paying for the selected billing group only.
              Other groups will be handled separately.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}