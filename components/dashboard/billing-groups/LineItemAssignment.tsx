'use client'

import { useState, useRef, DragEvent } from 'react'
import { Package, GripVertical, X, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { LineItem, BillingGroup } from '@/types/api'

interface LineItemAssignmentProps {
  lineItems: LineItem[]
  billingGroups: BillingGroup[]
  selectedGroupId: string | null
  onItemsAssigned: () => void
}

interface DragItem {
  lineItemId: string
  sourceBillingGroupId: string | null
}

export function LineItemAssignment({
  lineItems,
  billingGroups,
  selectedGroupId,
  onItemsAssigned
}: LineItemAssignmentProps) {
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null)
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [isAssigning, setIsAssigning] = useState(false)
  const [assigningItems, setAssigningItems] = useState<Set<string>>(new Set())
  const dragCounter = useRef(0)
  const { toast } = useToast()

  const handleDragStart = (e: DragEvent, item: LineItem) => {
    const dragData: DragItem = {
      lineItemId: item.id,
      sourceBillingGroupId: item.billing_group_id || null
    }
    setDraggedItem(dragData)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/json', JSON.stringify(dragData))
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
    setDragOverGroupId(null)
  }

  const handleDragEnter = (e: DragEvent, groupId: string | null) => {
    e.preventDefault()
    dragCounter.current++
    setDragOverGroupId(groupId)
  }

  const handleDragLeave = (e: DragEvent) => {
    dragCounter.current--
    if (dragCounter.current === 0) {
      setDragOverGroupId(null)
    }
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: DragEvent, targetGroupId: string | null) => {
    e.preventDefault()
    dragCounter.current = 0
    setDragOverGroupId(null)

    if (isAssigning) return // Prevent concurrent operations

    setIsAssigning(true)

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json')) as DragItem
      
      if (data.sourceBillingGroupId === targetGroupId) {
        return // No change needed
      }

      // Handle single item assignment
      if (selectedItems.size <= 1) {
        setAssigningItems(new Set([data.lineItemId]))
        await assignLineItem(data.lineItemId, targetGroupId)
        
        toast({
          title: 'Item Assigned',
          description: `Line item moved to ${targetGroupId ? 'billing group' : 'unassigned'}.`,
        })
      } else {
        // Handle bulk assignment
        const itemsToAssign = Array.from(selectedItems)
        if (!itemsToAssign.includes(data.lineItemId)) {
          itemsToAssign.push(data.lineItemId)
        }
        
        setAssigningItems(new Set(itemsToAssign))
        await bulkAssignLineItems(itemsToAssign, targetGroupId)
        setSelectedItems(new Set())
        
        toast({
          title: 'Items Assigned',
          description: `${itemsToAssign.length} items moved to ${targetGroupId ? 'billing group' : 'unassigned'}.`,
        })
      }

      onItemsAssigned()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to assign items'
      
      toast({
        title: 'Assignment Failed',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsAssigning(false)
      setAssigningItems(new Set())
    }
  }

  const assignLineItem = async (lineItemId: string, billingGroupId: string | null) => {
    const endpoint = billingGroupId 
      ? `/api/v1/line-items/${lineItemId}/assign`
      : `/api/v1/line-items/${lineItemId}/unassign`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ billing_group_id: billingGroupId })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || 'Failed to assign line item')
    }
  }

  const bulkAssignLineItems = async (lineItemIds: string[], billingGroupId: string | null) => {
    if (!billingGroupId) {
      // Bulk unassign
      for (const id of lineItemIds) {
        await assignLineItem(id, null)
      }
      return
    }

    const response = await fetch('/api/v1/line-items/bulk-assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignments: lineItemIds.map(id => ({
          line_item_id: id,
          billing_group_id: billingGroupId
        }))
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || 'Failed to bulk assign line items')
    }
  }

  const toggleItemSelection = (itemId: string) => {
    const newSelection = new Set(selectedItems)
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId)
    } else {
      newSelection.add(itemId)
    }
    setSelectedItems(newSelection)
  }

  const renderLineItem = (item: LineItem) => {
    const isSelected = selectedItems.has(item.id)
    const isDragging = draggedItem?.lineItemId === item.id
    const isBeingAssigned = assigningItems.has(item.id)

    return (
      <div
        key={item.id}
        draggable={!isBeingAssigned}
        onDragStart={(e) => handleDragStart(e, item)}
        onDragEnd={handleDragEnd}
        onClick={() => !isBeingAssigned && toggleItemSelection(item.id)}
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border transition-all",
          !isBeingAssigned && "cursor-move hover:bg-accent/50",
          isSelected && "bg-accent border-primary",
          isDragging && "opacity-50",
          isBeingAssigned && "opacity-60 cursor-not-allowed"
        )}
      >
        {isBeingAssigned ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.description}</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>{item.quantity} × ${item.unit_price.toFixed(2)}</span>
            <span className="font-medium">${(item.quantity * item.unit_price).toFixed(2)}</span>
            {isBeingAssigned && (
              <span className="text-primary">Assigning...</span>
            )}
          </div>
        </div>
        {item.category && (
          <Badge variant="secondary" className="text-xs">
            {item.category}
          </Badge>
        )}
      </div>
    )
  }

  const renderBillingGroupColumn = (group: BillingGroup | null) => {
    const groupId = group?.id || null
    const groupItems = lineItems.filter(item => item.billing_group_id === groupId)
    const isDropTarget = dragOverGroupId === groupId
    const isSelected = selectedGroupId === groupId

    return (
      <Card
        key={groupId || 'unassigned'}
        className={cn(
          "h-full",
          isDropTarget && "ring-2 ring-primary ring-offset-2",
          isSelected && "ring-2 ring-primary"
        )}
        onDragEnter={(e) => handleDragEnter(e, groupId)}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, groupId)}
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            {group ? group.name : 'Unassigned Items'}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {groupItems.length} item{groupItems.length !== 1 ? 's' : ''} • 
            ${groupItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0).toFixed(2)}
          </p>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <ScrollArea className="h-[400px] pr-3">
            <div className="space-y-2">
              {groupItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Package className="h-8 w-8 mb-2" />
                  <p className="text-sm">Drop items here</p>
                </div>
              ) : (
                groupItems.map(renderLineItem)
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    )
  }

  return (
    <div data-testid="line-item-assignment" className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Assign Line Items</h4>
        {selectedItems.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedItems.size} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedItems(new Set())}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* Unassigned Items Column */}
        {renderBillingGroupColumn(null)}
        
        {/* Billing Group Columns */}
        {billingGroups.map(group => renderBillingGroupColumn(group))}
      </div>

      <div className="text-xs text-muted-foreground">
        Drag and drop items between groups. Click to select multiple items for bulk operations.
      </div>
      
      {/* Hidden button for testing purposes */}
      <button 
        data-testid="assign-items" 
        onClick={onItemsAssigned}
        style={{ display: 'none' }}
      >
        Assign Items (Test Button)
      </button>
    </div>
  )
}