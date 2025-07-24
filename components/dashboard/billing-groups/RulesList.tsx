'use client'

import { useState, useEffect } from 'react'
import { Edit, Trash2, MoreVertical, Power, PowerOff, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import { RuleBuilder } from './RuleBuilder'
import type { BillingGroupRule } from '@/types/billing-groups'

interface RulesListProps {
  billingGroupId: string
  rules: BillingGroupRule[]
  onRulesUpdated: () => void
}

interface RulesListState {
  isLoading: boolean
  error: string | null
  editingRule: BillingGroupRule | null
  showEditDialog: boolean
}

export function RulesList({
  billingGroupId,
  rules,
  onRulesUpdated
}: RulesListProps) {
  const [state, setState] = useState<RulesListState>({
    isLoading: false,
    error: null,
    editingRule: null,
    showEditDialog: false
  })
  const { toast } = useToast()

  const toggleRuleStatus = async (ruleId: string, isActive: boolean) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await fetch(`/api/v1/billing-groups/${billingGroupId}/rules/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !isActive }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to update rule')
      }

      toast({
        title: 'Rule Updated',
        description: `Rule has been ${!isActive ? 'enabled' : 'disabled'}.`,
      })

      onRulesUpdated()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update rule'
      setState(prev => ({ ...prev, error: errorMessage }))

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule? This action cannot be undone.')) {
      return
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await fetch(`/api/v1/billing-groups/${billingGroupId}/rules/${ruleId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to delete rule')
      }

      toast({
        title: 'Rule Deleted',
        description: 'The rule has been permanently deleted.',
      })

      onRulesUpdated()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete rule'
      setState(prev => ({ ...prev, error: errorMessage }))

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }

  const editRule = (rule: BillingGroupRule) => {
    setState(prev => ({
      ...prev,
      editingRule: rule,
      showEditDialog: true
    }))
  }

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case 'auto_assign':
        return 'default'
      case 'require_approval':
        return 'secondary'
      case 'notify':
        return 'outline'
      case 'reject':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const formatConditions = (conditions: any) => {
    const parts = []

    if (conditions.category?.length) {
      parts.push(`Categories: ${conditions.category.join(', ')}`)
    }

    if (conditions.amount?.min !== undefined || conditions.amount?.max !== undefined) {
      const min = conditions.amount.min ?? 0
      const max = conditions.amount.max ?? '∞'
      parts.push(`Amount: $${min} - $${max}`)
    }

    if (conditions.time?.start && conditions.time?.end) {
      parts.push(`Time: ${conditions.time.start} - ${conditions.time.end}`)
    }

    if (conditions.dayOfWeek?.length) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const dayNames = conditions.dayOfWeek.map((d: number) => days[d]).join(', ')
      parts.push(`Days: ${dayNames}`)
    }

    if (conditions.metadata && Object.keys(conditions.metadata).length) {
      const metadataCount = Object.keys(conditions.metadata).length
      parts.push(`Custom: ${metadataCount} condition${metadataCount !== 1 ? 's' : ''}`)
    }

    return parts.length ? parts.join(' • ') : 'No conditions'
  }

  if (rules.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <p>No automation rules created yet.</p>
            <p className="text-sm mt-1">Create rules to automatically assign line items to this billing group.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Error Alert */}
      {state.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Rules List */}
      <div className="space-y-3">
        {rules.map((rule) => (
          <Card key={rule.id} className={`transition-opacity ${!rule.isActive ? 'opacity-60' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base">{rule.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={getActionBadgeVariant(rule.action)}>
                      {rule.action.replace('_', ' ')}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Priority: {rule.priority}
                    </Badge>
                    {!rule.isActive && (
                      <Badge variant="secondary" className="text-xs">
                        Disabled
                      </Badge>
                    )}
                  </div>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={state.isLoading}
                    >
                      {state.isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MoreVertical className="h-4 w-4" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => editRule(rule)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Rule
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => toggleRuleStatus(rule.id, rule.isActive)}
                    >
                      {rule.isActive ? (
                        <>
                          <PowerOff className="h-4 w-4 mr-2" />
                          Disable Rule
                        </>
                      ) : (
                        <>
                          <Power className="h-4 w-4 mr-2" />
                          Enable Rule
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => deleteRule(rule.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Rule
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-2">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-1">Conditions</h4>
                  <p className="text-sm">{formatConditions(rule.conditions)}</p>
                </div>
                
                {rule.metadata && Object.keys(rule.metadata).length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-1">Metadata</h4>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(rule.metadata).map(([key, value]) => (
                        <Badge key={key} variant="outline" className="text-xs">
                          {key}: {String(value)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Rule Dialog */}
      <RuleBuilder
        billingGroupId={billingGroupId}
        rule={state.editingRule || undefined}
        open={state.showEditDialog}
        onOpenChange={(open) => {
          setState(prev => ({
            ...prev,
            showEditDialog: open,
            editingRule: open ? prev.editingRule : null
          }))
        }}
        onRuleSaved={() => {
          onRulesUpdated()
          setState(prev => ({
            ...prev,
            showEditDialog: false,
            editingRule: null
          }))
        }}
      />
    </div>
  )
}
