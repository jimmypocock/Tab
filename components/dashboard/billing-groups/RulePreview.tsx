'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import type { RuleConditions, RuleAction } from '@/types/billing-groups'
import type { LineItem } from '@/types/api'

interface RulePreviewProps {
  billingGroupId: string
  ruleData: {
    name: string
    conditions: RuleConditions
    action: RuleAction
    priority: number
  }
}

interface PreviewResult {
  matchingItems: LineItem[]
  nonMatchingItems: LineItem[]
  totalMatches: number
  estimatedImpact: {
    itemsAffected: number
    totalAmount: number
  }
}

export function RulePreview({ billingGroupId, ruleData }: RulePreviewProps) {
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runPreview = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/v1/billing-groups/${billingGroupId}/rules/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conditions: ruleData.conditions,
          action: ruleData.action,
          priority: ruleData.priority,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to preview rule')
      }

      const data = await response.json()
      setPreviewResult(data)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to preview rule'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-run preview when rule data changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (hasValidConditions()) {
        runPreview()
      }
    }, 1000) // Debounce by 1 second

    return () => clearTimeout(timer)
  }, [ruleData.conditions, ruleData.action, ruleData.priority])

  const hasValidConditions = () => {
    const conditions = ruleData.conditions
    return (
      conditions.category?.length ||
      conditions.amount?.min !== undefined ||
      conditions.amount?.max !== undefined ||
      conditions.time?.start ||
      conditions.time?.end ||
      conditions.dayOfWeek?.length ||
      Object.keys(conditions.metadata || {}).length
    )
  }

  const getActionBadgeVariant = (action: RuleAction) => {
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

  const formatConditionsSummary = () => {
    const conditions = ruleData.conditions
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
      const dayNames = conditions.dayOfWeek.map(d => days[d]).join(', ')
      parts.push(`Days: ${dayNames}`)
    }

    if (conditions.metadata && Object.keys(conditions.metadata).length) {
      const metadataCount = Object.keys(conditions.metadata).length
      parts.push(`Custom conditions: ${metadataCount}`)
    }

    return parts.join(' • ') || 'No conditions set'
  }

  if (!hasValidConditions()) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center text-muted-foreground">
            <AlertCircle className="h-4 w-4 mr-2" />
            Add conditions to see preview
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>Rule Preview: {ruleData.name || 'Unnamed Rule'}</span>
          <div className="flex items-center gap-2">
            <Badge variant={getActionBadgeVariant(ruleData.action)}>
              {ruleData.action.replace('_', ' ')}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Priority: {ruleData.priority}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Conditions Summary */}
        <div>
          <h4 className="font-medium text-sm mb-2">Conditions</h4>
          <p className="text-sm text-muted-foreground">
            {formatConditionsSummary()}
          </p>
        </div>

        <Separator />

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm text-muted-foreground">Running preview...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              {error}
              <Button
                variant="outline"
                size="sm"
                onClick={runPreview}
                className="ml-2"
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Preview Results */}
        {previewResult && !isLoading && (
          <div className="space-y-4">
            {/* Impact Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="text-2xl font-bold text-green-700">
                  {previewResult.totalMatches}
                </div>
                <div className="text-sm text-green-600">Matching Items</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-2xl font-bold text-blue-700">
                  ${previewResult.estimatedImpact.totalAmount.toFixed(2)}
                </div>
                <div className="text-sm text-blue-600">Total Amount</div>
              </div>
            </div>

            {/* Action Impact */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Expected Action</h4>
              <div className="p-3 bg-muted/50 rounded-lg">
                {ruleData.action === 'auto_assign' && (
                  <div className="flex items-center text-green-700">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {previewResult.totalMatches} items will be automatically assigned to this billing group
                  </div>
                )}
                {ruleData.action === 'require_approval' && (
                  <div className="flex items-center text-yellow-700">
                    <Clock className="h-4 w-4 mr-2" />
                    {previewResult.totalMatches} items will require manual approval before assignment
                  </div>
                )}
                {ruleData.action === 'notify' && (
                  <div className="flex items-center text-blue-700">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Notifications will be sent for {previewResult.totalMatches} matching items
                  </div>
                )}
                {ruleData.action === 'reject' && (
                  <div className="flex items-center text-red-700">
                    <XCircle className="h-4 w-4 mr-2" />
                    {previewResult.totalMatches} items will be rejected from this billing group
                  </div>
                )}
              </div>
            </div>

            {/* Sample Matching Items */}
            {previewResult.matchingItems.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">
                  Sample Matching Items ({Math.min(3, previewResult.matchingItems.length)} of {previewResult.totalMatches})
                </h4>
                <div className="space-y-2">
                  {previewResult.matchingItems.slice(0, 3).map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-green-50 rounded border border-green-200">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{item.description}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.metadata?.category} • Qty: {item.quantity}
                        </div>
                      </div>
                      <div className="font-medium text-green-700">
                        ${(parseFloat(item.unitPrice) * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
                {previewResult.totalMatches > 3 && (
                  <p className="text-xs text-muted-foreground text-center">
                    ... and {previewResult.totalMatches - 3} more items
                  </p>
                )}
              </div>
            )}

            {/* No Matches */}
            {previewResult.totalMatches === 0 && (
              <div className="text-center py-6">
                <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No existing items match these conditions.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  This rule will apply to future items that match.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Manual Refresh */}
        {!isLoading && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={runPreview}
            >
              Refresh Preview
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
