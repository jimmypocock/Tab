'use client'

import { useState } from 'react'
import { Plus, Settings, AlertCircle, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { BillingGroupCard } from './BillingGroupCard'
import { LineItemAssignment } from './LineItemAssignment'
import { CreateBillingGroupDialog } from './CreateBillingGroupDialog'
import type { BillingGroup, LineItem, Tab } from '@/types/api'

interface BillingGroupsManagerState {
  isEnabling: boolean
  error: string | null
  isRefreshing: boolean
}

interface BillingGroupsManagerProps {
  tab: Tab
  billingGroups: BillingGroup[]
  lineItems: LineItem[]
  onUpdate: () => void
}

export function BillingGroupsManager({
  tab,
  billingGroups,
  lineItems,
  onUpdate
}: BillingGroupsManagerProps) {
  const [isEnabled, setIsEnabled] = useState(billingGroups.length > 0)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [state, setState] = useState<BillingGroupsManagerState>({
    isEnabling: false,
    error: null,
    isRefreshing: false
  })
  
  const { toast } = useToast()
  const unassignedItems = lineItems.filter(item => !item.billing_group_id)
  const hasUnassignedItems = unassignedItems.length > 0

  const handleEnableBillingGroups = async () => {
    setState(prev => ({ ...prev, isEnabling: true, error: null }))
    
    try {
      const response = await fetch(`/api/v1/tabs/${tab.id}/enable-billing-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to enable billing groups')
      }
      
      const data = await response.json()
      setIsEnabled(true)
      
      toast({
        title: 'Billing Groups Enabled',
        description: `Created ${data.groups?.length || 1} billing group${data.groups?.length !== 1 ? 's' : ''} successfully.`,
      })
      
      onUpdate()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to enable billing groups'
      setState(prev => ({ ...prev, error: errorMessage }))
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setState(prev => ({ ...prev, isEnabling: false }))
    }
  }

  const handleItemsAssigned = () => {
    setState(prev => ({ ...prev, isRefreshing: true }))
    onUpdate()
    setState(prev => ({ ...prev, isRefreshing: false }))
  }

  const handleRetry = () => {
    setState(prev => ({ ...prev, error: null }))
  }

  if (!isEnabled) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          {/* Error Alert */}
          {state.error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                {state.error}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  className="ml-2"
                >
                  Try Again
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Billing Groups</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Split charges between different payers or payment methods
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Label htmlFor="enable-billing-groups">Enable</Label>
              <Switch
                id="enable-billing-groups"
                checked={isEnabled}
                onCheckedChange={handleEnableBillingGroups}
                disabled={state.isEnabling}
              />
              {state.isEnabling && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>
          
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p>Billing groups allow you to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Split bills between multiple payers</li>
              <li>Apply deposits or credit limits</li>
              <li>Set up automatic charge routing rules</li>
              <li>Track corporate vs personal expenses</li>
            </ul>
          </div>
          
          {state.isEnabling && (
            <div className="flex items-center justify-center py-4">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Setting up billing groups...</span>
              </div>
            </div>
          )}
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {state.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            {state.error}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              className="ml-2"
            >
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Billing Groups</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Manage how charges are split and assigned
            {state.isRefreshing && (
              <span className="inline-flex items-center ml-2">
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Updating...
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateDialog(true)}
            disabled={state.isRefreshing}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Group
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            disabled={state.isRefreshing}
            title="Billing Group Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Unassigned Items Alert */}
      {hasUnassignedItems && !state.isRefreshing && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {unassignedItems.length} item{unassignedItems.length > 1 ? 's' : ''} not assigned to any billing group
          </AlertDescription>
        </Alert>
      )}

      {/* Billing Groups Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {billingGroups.map((group) => (
          <BillingGroupCard
            key={group.id}
            group={group}
            lineItems={lineItems.filter(item => item.billing_group_id === group.id)}
            isSelected={selectedGroupId === group.id}
            onClick={() => setSelectedGroupId(group.id)}
            onUpdate={onUpdate}
          />
        ))}
      </div>

      {/* Line Items Assignment */}
      {lineItems.length > 0 && (
        <LineItemAssignment
          lineItems={lineItems}
          billingGroups={billingGroups}
          selectedGroupId={selectedGroupId}
          onItemsAssigned={handleItemsAssigned}
        />
      )}

      {/* Create Billing Group Dialog */}
      <CreateBillingGroupDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        tabId={tab.id}
        onCreated={onUpdate}
      />
    </div>
  )
}