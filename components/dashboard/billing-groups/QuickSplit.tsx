'use client'

import { useState } from 'react'
import { Zap, Users, Building2, Receipt, Calculator } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface QuickSplitProps {
  tabId: string
  onComplete: () => void
}

interface SplitTemplate {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  action: () => Promise<void>
}

export function QuickSplit({ tabId, onComplete }: QuickSplitProps) {
  const [isProcessing, setIsProcessing] = useState<string | null>(null)

  const handleEvenSplit = async (numberOfGroups: number) => {
    setIsProcessing('even-split')
    try {
      const response = await fetch(`/api/v1/tabs/${tabId}/quick-split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          split_type: 'even',
          number_of_groups: numberOfGroups,
        }),
      })

      if (!response.ok) throw new Error('Failed to split tab')
      
      onComplete()
    } catch (error) {
      console.error('Error splitting tab:', error)
    } finally {
      setIsProcessing(null)
    }
  }

  const handleCorporatePersonalSplit = async () => {
    setIsProcessing('corporate-personal')
    try {
      const response = await fetch(`/api/v1/tabs/${tabId}/quick-split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          split_type: 'corporate_personal',
          rules: {
            corporate: {
              categories: ['business_meals', 'accommodation', 'transport'],
              time_range: { start: '09:00', end: '17:00' },
              weekdays_only: true,
            },
            personal: {
              categories: ['minibar', 'spa', 'entertainment'],
            },
          },
        }),
      })

      if (!response.ok) throw new Error('Failed to split tab')
      
      onComplete()
    } catch (error) {
      console.error('Error splitting tab:', error)
    } finally {
      setIsProcessing(null)
    }
  }

  const handleByCategory = async () => {
    setIsProcessing('by-category')
    try {
      const response = await fetch(`/api/v1/tabs/${tabId}/quick-split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          split_type: 'by_category',
        }),
      })

      if (!response.ok) throw new Error('Failed to split tab')
      
      onComplete()
    } catch (error) {
      console.error('Error splitting tab:', error)
    } finally {
      setIsProcessing(null)
    }
  }

  const templates: SplitTemplate[] = [
    {
      id: 'even-2',
      name: 'Split in Half',
      description: 'Divide all charges equally between 2 groups',
      icon: <Users className="h-5 w-5" />,
      action: () => handleEvenSplit(2),
    },
    {
      id: 'even-3',
      name: 'Split 3 Ways',
      description: 'Divide all charges equally between 3 groups',
      icon: <Users className="h-5 w-5" />,
      action: () => handleEvenSplit(3),
    },
    {
      id: 'even-4',
      name: 'Split 4 Ways',
      description: 'Divide all charges equally between 4 groups',
      icon: <Users className="h-5 w-5" />,
      action: () => handleEvenSplit(4),
    },
    {
      id: 'corporate-personal',
      name: 'Corporate vs Personal',
      description: 'Separate business and personal expenses automatically',
      icon: <Building2 className="h-5 w-5" />,
      action: handleCorporatePersonalSplit,
    },
    {
      id: 'by-category',
      name: 'By Category',
      description: 'Create groups for each charge category',
      icon: <Receipt className="h-5 w-5" />,
      action: handleByCategory,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Quick Split Options</h3>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <Card
            key={template.id}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              isProcessing === template.id && "opacity-50 cursor-not-allowed"
            )}
          >
            <CardContent className="p-4">
              <Button
                variant="ghost"
                className="w-full h-auto p-0 hover:bg-transparent"
                onClick={template.action}
                disabled={isProcessing !== null}
              >
                <div className="flex items-start gap-3 text-left">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {template.icon}
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-medium">{template.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {template.description}
                    </p>
                  </div>
                </div>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Calculator className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="space-y-1 text-sm">
              <p className="font-medium">Need a custom split?</p>
              <p className="text-muted-foreground">
                Use the manual assignment tool above for complete control over how charges are distributed.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}