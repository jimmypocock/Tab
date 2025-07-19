import React from 'react'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: string | number
  description?: string
  icon?: LucideIcon
  iconColor?: string
  iconBgColor?: string
  trend?: {
    value: number
    isPositive: boolean
  }
  className?: string
}

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  iconColor = 'text-gray-600',
  iconBgColor = 'bg-gray-100',
  trend,
  className
}: StatsCardProps) {
  return (
    <div className={cn('bg-white rounded-lg shadow-sm p-6', className)}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
          {description && (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          )}
          {trend && (
            <div className="mt-2 flex items-center text-sm">
              <span
                className={cn(
                  'font-medium',
                  trend.isPositive ? 'text-green-600' : 'text-red-600'
                )}
              >
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              <span className="ml-2 text-gray-500">from last month</span>
            </div>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              'rounded-full p-3',
              iconBgColor
            )}
          >
            <Icon className={cn('h-6 w-6', iconColor)} />
          </div>
        )}
      </div>
    </div>
  )
}