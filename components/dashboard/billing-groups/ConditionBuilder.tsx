'use client'

import { useState, useEffect } from 'react'
import { Plus, X, Clock, Calendar, DollarSign, Tag, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { RuleConditions } from '@/types/billing-groups'

interface ConditionBuilderProps {
  conditions: RuleConditions
  onChange: (conditions: RuleConditions) => void
  disabled?: boolean
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

const COMMON_CATEGORIES = [
  'food',
  'beverages',
  'accommodation',
  'transport',
  'entertainment',
  'business_meals',
  'spa_services',
  'room_service',
  'incidentals',
  'tips',
  'taxes_fees',
]

export function ConditionBuilder({
  conditions,
  onChange,
  disabled = false
}: ConditionBuilderProps) {
  const [newCategory, setNewCategory] = useState('')
  const [newMetadataKey, setNewMetadataKey] = useState('')
  const [newMetadataValue, setNewMetadataValue] = useState('')

  const updateConditions = (updates: Partial<RuleConditions>) => {
    onChange({ ...conditions, ...updates })
  }

  const addCategory = (category: string) => {
    if (!category.trim()) return
    
    const currentCategories = conditions.category || []
    if (!currentCategories.includes(category)) {
      updateConditions({
        category: [...currentCategories, category]
      })
    }
    setNewCategory('')
  }

  const removeCategory = (category: string) => {
    const currentCategories = conditions.category || []
    updateConditions({
      category: currentCategories.filter(c => c !== category)
    })
  }

  const toggleDayOfWeek = (day: number) => {
    const currentDays = conditions.dayOfWeek || []
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day]
    
    updateConditions({ dayOfWeek: newDays })
  }

  const addMetadata = () => {
    if (!newMetadataKey.trim() || !newMetadataValue.trim()) return
    
    const currentMetadata = conditions.metadata || {}
    updateConditions({
      metadata: {
        ...currentMetadata,
        [newMetadataKey]: newMetadataValue
      }
    })
    
    setNewMetadataKey('')
    setNewMetadataValue('')
  }

  const removeMetadata = (key: string) => {
    const currentMetadata = conditions.metadata || {}
    const { [key]: removed, ...rest } = currentMetadata
    updateConditions({ metadata: rest })
  }

  return (
    <div className="space-y-6">
      {/* Category Conditions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <Tag className="h-4 w-4 mr-2" />
            Categories
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(conditions.category || []).map(category => (
              <Badge
                key={category}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {category}
                <button
                  type="button"
                  onClick={() => removeCategory(category)}
                  disabled={disabled}
                  className="ml-1 hover:bg-red-100 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          
          <div className="flex gap-2">
            <Select
              value={newCategory}
              onValueChange={setNewCategory}
              disabled={disabled}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {COMMON_CATEGORIES.map(category => (
                  <SelectItem key={category} value={category}>
                    {category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addCategory(newCategory)}
              disabled={disabled || !newCategory}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Input
              placeholder="Custom category"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addCategory(newCategory)}
              disabled={disabled}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addCategory(newCategory)}
              disabled={disabled || !newCategory}
            >
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Amount Conditions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <DollarSign className="h-4 w-4 mr-2" />
            Amount Range
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="min-amount">Minimum Amount</Label>
              <Input
                id="min-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={conditions.amount?.min || ''}
                onChange={(e) => {
                  const value = e.target.value ? parseFloat(e.target.value) : undefined
                  updateConditions({
                    amount: { ...conditions.amount, min: value }
                  })
                }}
                disabled={disabled}
              />
            </div>
            <div>
              <Label htmlFor="max-amount">Maximum Amount</Label>
              <Input
                id="max-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="No limit"
                value={conditions.amount?.max || ''}
                onChange={(e) => {
                  const value = e.target.value ? parseFloat(e.target.value) : undefined
                  updateConditions({
                    amount: { ...conditions.amount, max: value }
                  })
                }}
                disabled={disabled}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Time Conditions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <Clock className="h-4 w-4 mr-2" />
            Time Range
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start-time">Start Time</Label>
              <Input
                id="start-time"
                type="time"
                value={conditions.time?.start || ''}
                onChange={(e) => {
                  updateConditions({
                    time: { ...conditions.time, start: e.target.value || undefined }
                  })
                }}
                disabled={disabled}
              />
            </div>
            <div>
              <Label htmlFor="end-time">End Time</Label>
              <Input
                id="end-time"
                type="time"
                value={conditions.time?.end || ''}
                onChange={(e) => {
                  updateConditions({
                    time: { ...conditions.time, end: e.target.value || undefined }
                  })
                }}
                disabled={disabled}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Day of Week Conditions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <Calendar className="h-4 w-4 mr-2" />
            Days of Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map(day => {
              const isSelected = (conditions.dayOfWeek || []).includes(day.value)
              return (
                <Button
                  key={day.value}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleDayOfWeek(day.value)}
                  disabled={disabled}
                  className="min-w-[80px]"
                >
                  {day.label.slice(0, 3)}
                </Button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Custom Metadata Conditions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center text-base">
            <Settings className="h-4 w-4 mr-2" />
            Custom Conditions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {Object.entries(conditions.metadata || {}).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between bg-muted/50 rounded p-2">
                <div className="flex-1">
                  <span className="font-medium text-sm">{key}:</span>
                  <span className="ml-2 text-sm text-muted-foreground">{String(value)}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMetadata(key)}
                  disabled={disabled}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          
          <Separator />
          
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Property name"
              value={newMetadataKey}
              onChange={(e) => setNewMetadataKey(e.target.value)}
              disabled={disabled}
            />
            <Input
              placeholder="Expected value"
              value={newMetadataValue}
              onChange={(e) => setNewMetadataValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addMetadata()}
              disabled={disabled}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addMetadata}
            disabled={disabled || !newMetadataKey || !newMetadataValue}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Custom Condition
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
