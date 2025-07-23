'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui'
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Webhook } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/lib/toast/toast-context'

interface WebhookStatusProps {
  processorId: string
  processorType: string
  onRefresh?: () => void
}

export function WebhookStatus({ processorId, processorType, onRefresh }: WebhookStatusProps) {
  const { showToast } = useToast()
  const [status, setStatus] = useState<{
    configured: boolean
    active: boolean
    lastPing?: Date
    loading: boolean
  }>({
    configured: false,
    active: false,
    loading: true,
  })

  const checkWebhookStatus = async () => {
    setStatus(prev => ({ ...prev, loading: true }))
    
    try {
      const response = await fetch(`/api/v1/merchant/processors/${processorId}/webhook-status`)
      if (response.ok) {
        const data = await response.json()
        setStatus({
          ...data,
          lastPing: data.lastPing ? new Date(data.lastPing) : undefined,
          loading: false,
        })
      } else {
        setStatus(prev => ({ ...prev, loading: false }))
      }
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Failed to check webhook status',
        description: 'Could not retrieve webhook status information'
      })
      setStatus(prev => ({ ...prev, loading: false }))
    }
  }

  useEffect(() => {
    checkWebhookStatus()
  }, [processorId])

  if (status.loading) {
    return (
      <div className="flex items-center space-x-2">
        <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />
        <span className="text-sm text-gray-500">Checking webhook status...</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Webhook className="h-5 w-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Webhook Status</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            checkWebhookStatus()
            onRefresh?.()
          }}
          className="text-xs"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-2">
        {/* Configuration Status */}
        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-600">Configuration</span>
          {status.configured ? (
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <Badge variant="success" size="sm">Configured</Badge>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <Badge variant="danger" size="sm">Not Configured</Badge>
            </div>
          )}
        </div>

        {/* Active Status */}
        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-600">Status</span>
          {status.active ? (
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
              <Badge variant="success" size="sm">Active</Badge>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 bg-gray-400 rounded-full" />
              <Badge variant="secondary" size="sm">Inactive</Badge>
            </div>
          )}
        </div>

        {/* Last Activity */}
        {status.lastPing && (
          <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-600">Last Activity</span>
            <span className="text-xs text-gray-500">
              {status.lastPing.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Help Text */}
      {status.configured && status.active ? (
        <div className="flex items-start space-x-2 text-xs text-green-600 bg-green-50 p-2 rounded-lg">
          <CheckCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
          <span>
            Webhooks are automatically configured and ready to receive events from {processorType}.
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-start space-x-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">
            <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>
              Webhook not receiving events. To fix this:
            </span>
          </div>
          <div className="text-xs text-gray-600 pl-7 space-y-1">
            <div>1. Go to your {processorType} dashboard → Webhooks</div>
            <div>2. Add the webhook URL shown below</div>
            <div>3. Select all payment events</div>
            <div>4. Save and test the webhook</div>
          </div>
          <div className="text-xs text-gray-500 pl-7">
            <a 
              href={processorType === 'Stripe' ? 'https://dashboard.stripe.com/webhooks' : '#'} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-600 hover:underline"
            >
              Open {processorType} Webhook Settings →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}