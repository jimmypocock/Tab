'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export interface Tab {
  name: string
  href: string
  count?: number
}

interface TabsProps {
  tabs: Tab[]
  className?: string
}

export function Tabs({ tabs, className }: TabsProps) {
  const pathname = usePathname()
  
  return (
    <div className={className}>
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href
            
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={cn(
                  'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium',
                  isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                {tab.name}
                {tab.count !== undefined && (
                  <span
                    className={cn(
                      'ml-2 rounded-full py-0.5 px-2.5 text-xs font-medium',
                      isActive
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-900'
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}