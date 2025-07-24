'use client'

import { useState } from 'react'
import { MoreVertical, Building2, CreditCard, DollarSign, User, Edit, Trash, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { BillingGroup, LineItem } from '@/types/api'

interface BillingGroupCardProps {
  group: BillingGroup
  lineItems: LineItem[]
  isSelected?: boolean
  onClick?: () => void
  onUpdate: () => void
}

export function BillingGroupCard({
  group,
  lineItems,
  isSelected = false,
  onClick,
  onUpdate
}: BillingGroupCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()
  
  const totalAmount = lineItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
  const depositRemaining = group.deposit_amount ? group.deposit_amount - (group.deposit_applied || 0) : 0
  const creditUsage = group.credit_limit ? (group.current_balance / group.credit_limit) * 100 : 0

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this billing group? All items will be unassigned.')) {
      return
    }
    
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/v1/billing-groups/${group.id}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to delete billing group')
      }
      
      toast({
        title: 'Billing Group Deleted',
        description: `"${group.name}" has been deleted and all items unassigned.`,
      })
      
      onUpdate()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete billing group'
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const getGroupIcon = () => {
    switch (group.group_type) {
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

  const getGroupTypeColor = () => {
    switch (group.group_type) {
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

  return (
    <Card 
      data-testid={`billing-group-${group.id}`}
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        isSelected && "ring-2 ring-primary",
        isDeleting && "opacity-50"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-medium">{group.name}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn("text-xs", getGroupTypeColor())}>
                {getGroupIcon()}
                <span className="ml-1">{group.group_type}</span>
              </Badge>
              {group.status !== 'active' && (
                <Badge variant="secondary" className="text-xs">
                  {group.status}
                </Badge>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Edit className="h-4 w-4 mr-2" />
                Edit Group
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete()
                }}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash className="h-4 w-4 mr-2" />
                )}
                {isDeleting ? 'Deleting...' : 'Delete Group'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Payer Info */}
        {group.payer_email && (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">Payer:</span> {group.payer_email}
          </div>
        )}

        {/* Items and Amount */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">
            {lineItems.length} item{lineItems.length !== 1 ? 's' : ''}
          </span>
          <span className="font-semibold">
            ${totalAmount.toFixed(2)}
          </span>
        </div>

        {/* Deposit Progress */}
        {group.deposit_amount && group.deposit_amount > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Deposit</span>
              <span>${depositRemaining.toFixed(2)} remaining</span>
            </div>
            <Progress 
              value={(group.deposit_applied || 0) / group.deposit_amount * 100} 
              className="h-2"
            />
          </div>
        )}

        {/* Credit Limit Progress */}
        {group.credit_limit && group.credit_limit > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Credit Used</span>
              <span>${group.current_balance.toFixed(2)} / ${group.credit_limit.toFixed(2)}</span>
            </div>
            <Progress 
              value={creditUsage} 
              className={cn(
                "h-2",
                creditUsage > 90 && "bg-red-100 [&>div]:bg-red-500",
                creditUsage > 75 && creditUsage <= 90 && "bg-yellow-100 [&>div]:bg-yellow-500"
              )}
            />
          </div>
        )}

        {/* Rules Count */}
        {group.rules_count && group.rules_count > 0 && (
          <div className="text-xs text-muted-foreground">
            {group.rules_count} automation rule{group.rules_count !== 1 ? 's' : ''}
          </div>
        )}
      </CardContent>
    </Card>
  )
}