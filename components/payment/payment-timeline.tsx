'use client'

import React from 'react'
import { Clock, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PaymentEvent {
  id: string
  type: 'created' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'disputed'
  description: string
  timestamp: Date
  amount?: number
  metadata?: Record<string, any>
}

interface PaymentTimelineProps {
  events: PaymentEvent[]
  className?: string
}

const eventConfig = {
  created: {
    icon: Clock,
    color: 'text-gray-500',
    bgColor: 'bg-gray-100'
  },
  processing: {
    icon: RefreshCw,
    color: 'text-blue-500',
    bgColor: 'bg-blue-100'
  },
  succeeded: {
    icon: CheckCircle,
    color: 'text-green-500',
    bgColor: 'bg-green-100'
  },
  failed: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-100'
  },
  refunded: {
    icon: RefreshCw,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-100'
  },
  disputed: {
    icon: AlertCircle,
    color: 'text-orange-500',
    bgColor: 'bg-orange-100'
  }
}

export function PaymentTimeline({ events, className }: PaymentTimelineProps) {
  const sortedEvents = [...events].sort((a, b) => 
    b.timestamp.getTime() - a.timestamp.getTime()
  )
  
  return (
    <div className={cn('flow-root', className)} data-testid="payment-timeline">
      <ul className="-mb-8">
        {sortedEvents.map((event, eventIdx) => {
          const config = eventConfig[event.type]
          const Icon = config.icon
          const isLast = eventIdx === sortedEvents.length - 1
          
          return (
            <li key={event.id}>
              <div className="relative pb-8">
                {!isLast && (
                  <span
                    className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex space-x-3">
                  <div>
                    <span
                      className={cn(
                        'h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white',
                        config.bgColor
                      )}
                    >
                      <Icon className={cn('h-5 w-5', config.color)} aria-hidden="true" />
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                    <div>
                      <p className="text-sm text-gray-900">{event.description}</p>
                      {event.amount && (
                        <p className="text-sm text-gray-500">
                          Amount: ${(event.amount / 100).toFixed(2)}
                        </p>
                      )}
                    </div>
                    <div className="whitespace-nowrap text-right text-sm text-gray-500">
                      <time dateTime={event.timestamp.toISOString()}>
                        {new Intl.DateTimeFormat('en-US', {
                          dateStyle: 'short',
                          timeStyle: 'short'
                        }).format(event.timestamp)}
                      </time>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}