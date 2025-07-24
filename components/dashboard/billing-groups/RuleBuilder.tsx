'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Save, X, TestTube, AlertTriangle, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { ConditionBuilder } from './ConditionBuilder'
import { RulePreview } from './RulePreview'
import type { BillingGroupRule, RuleConditions, RuleAction } from '@/types/billing-groups'

const ruleSchema = z.object({
  name: z.string().min(1, 'Rule name is required').max(100, 'Name too long'),
  priority: z.number().min(1).max(1000).default(100),
  action: z.enum(['auto_assign', 'require_approval', 'notify', 'reject']).default('auto_assign'),
  conditions: z.object({
    category: z.array(z.string()).optional(),
    amount: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
    }).optional(),
    time: z.object({
      start: z.string().optional(),
      end: z.string().optional(),
    }).optional(),
    dayOfWeek: z.array(z.number().min(0).max(6)).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }).default({}),
  isActive: z.boolean().default(true),
})

type RuleFormData = z.infer<typeof ruleSchema>

interface RuleBuilderProps {
  billingGroupId: string
  rule?: BillingGroupRule // For editing existing rules
  open: boolean
  onOpenChange: (open: boolean) => void
  onRuleSaved: () => void
}

const actionLabels = {
  auto_assign: 'Auto Assign',
  require_approval: 'Require Approval',
  notify: 'Notify Only',
  reject: 'Reject Assignment',
}

const actionDescriptions = {
  auto_assign: 'Automatically assign matching items to this billing group',
  require_approval: 'Flag matching items for manual approval before assignment',
  notify: 'Send notification when items match but don\'t auto-assign',
  reject: 'Reject matching items from being assigned to this group',
}

export function RuleBuilder({
  billingGroupId,
  rule,
  open,
  onOpenChange,
  onRuleSaved
}: RuleBuilderProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const { toast } = useToast()

  const form = useForm<RuleFormData>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      name: rule?.name || '',
      priority: rule?.priority || 100,
      action: (rule?.action as RuleAction) || 'auto_assign',
      conditions: rule?.conditions || {},
      isActive: rule?.isActive ?? true,
    },
  })

  const { watch, handleSubmit, reset, formState: { errors } } = form

  // Watch form values for live preview
  const watchedValues = watch()

  // Reset form when dialog opens/closes or rule changes
  useEffect(() => {
    if (open) {
      reset({
        name: rule?.name || '',
        priority: rule?.priority || 100,
        action: (rule?.action as RuleAction) || 'auto_assign',
        conditions: rule?.conditions || {},
        isActive: rule?.isActive ?? true,
      })
      setError(null)
    }
  }, [open, rule, reset])

  const onSubmit = async (data: RuleFormData) => {
    setIsSaving(true)
    setError(null)

    try {
      const endpoint = rule
        ? `/api/v1/billing-groups/${billingGroupId}/rules/${rule.id}`
        : `/api/v1/billing-groups/${billingGroupId}/rules`

      const method = rule ? 'PUT' : 'POST'

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          priority: data.priority,
          action: data.action,
          conditions: data.conditions,
          is_active: data.isActive,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to save rule')
      }

      toast({
        title: rule ? 'Rule Updated' : 'Rule Created',
        description: `"${data.name}" has been ${rule ? 'updated' : 'created'} successfully.`,
      })

      onRuleSaved()
      onOpenChange(false)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save rule'
      setError(errorMessage)

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const hasConditions = () => {
    const conditions = watchedValues.conditions
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

  const getConditionSummary = () => {
    const conditions = watchedValues.conditions
    const summaryParts = []

    if (conditions.category?.length) {
      summaryParts.push(`Categories: ${conditions.category.join(', ')}`)
    }

    if (conditions.amount?.min !== undefined || conditions.amount?.max !== undefined) {
      const min = conditions.amount.min ?? 0
      const max = conditions.amount.max ?? '∞'
      summaryParts.push(`Amount: $${min} - $${max}`)
    }

    if (conditions.time?.start && conditions.time?.end) {
      summaryParts.push(`Time: ${conditions.time.start} - ${conditions.time.end}`)
    }

    if (conditions.dayOfWeek?.length) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const dayNames = conditions.dayOfWeek.map(d => days[d]).join(', ')
      summaryParts.push(`Days: ${dayNames}`)
    }

    if (conditions.metadata && Object.keys(conditions.metadata).length) {
      const metadataCount = Object.keys(conditions.metadata).length
      summaryParts.push(`Custom conditions: ${metadataCount}`)
    }

    return summaryParts.length ? summaryParts.join(' • ') : 'No conditions set'
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            {rule ? 'Edit Rule' : 'Create New Rule'}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              disabled={!hasConditions()}
            >
              <TestTube className="h-4 w-4 mr-2" />
              {showPreview ? 'Hide Preview' : 'Preview'}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="overflow-y-auto max-h-[calc(90vh-120px)]">
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Rule Basics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="name">Rule Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Corporate Expenses"
                  {...form.register('name')}
                  disabled={isSaving}
                />
                {errors.name && (
                  <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="priority">
                  Priority: {watchedValues.priority}
                </Label>
                <div className="px-2 py-4">
                  <Slider
                    value={[watchedValues.priority]}
                    onValueChange={(value) => form.setValue('priority', value[0])}
                    min={1}
                    max={1000}
                    step={1}
                    disabled={isSaving}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>High (1)</span>
                    <span>Low (1000)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Selection */}
            <div>
              <Label>Action</Label>
              <RadioGroup
                value={watchedValues.action}
                onValueChange={(value) => form.setValue('action', value as RuleAction)}
                disabled={isSaving}
                className="mt-2"
              >
                {Object.entries(actionLabels).map(([value, label]) => (
                  <div key={value} className="flex items-center space-x-2">
                    <RadioGroupItem value={value} id={value} />
                    <div className="flex-1">
                      <Label htmlFor={value} className="font-medium">
                        {label}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {actionDescriptions[value as RuleAction]}
                      </p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Conditions */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <Label>Conditions</Label>
                {hasConditions() && (
                  <Badge variant="secondary" className="text-xs">
                    {getConditionSummary()}
                  </Badge>
                )}
              </div>

              <ConditionBuilder
                conditions={watchedValues.conditions}
                onChange={(conditions) => form.setValue('conditions', conditions)}
                disabled={isSaving}
              />
            </div>

            {/* Preview */}
            {showPreview && hasConditions() && (
              <div>
                <Label>Rule Preview</Label>
                <RulePreview
                  billingGroupId={billingGroupId}
                  ruleData={{
                    name: watchedValues.name,
                    conditions: watchedValues.conditions,
                    action: watchedValues.action,
                    priority: watchedValues.priority,
                  }}
                />
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-6 border-t">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  {...form.register('isActive')}
                  disabled={isSaving}
                />
                <Label htmlFor="isActive">Enable this rule</Label>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {rule ? 'Update Rule' : 'Create Rule'}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}