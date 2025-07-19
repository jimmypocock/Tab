'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

export interface NavItem {
  name: string
  href: string
  icon: LucideIcon
  badge?: string | number
}

interface SidebarProps {
  logo?: React.ReactNode
  navItems: NavItem[]
  footer?: React.ReactNode
  className?: string
}

export function Sidebar({ logo, navItems, footer, className }: SidebarProps) {
  const pathname = usePathname()
  
  return (
    <div className={cn('flex h-full flex-col bg-white border-r border-gray-200', className)}>
      {/* Logo */}
      {logo && (
        <div className="flex h-16 items-center px-6 border-b border-gray-200">
          {logo}
        </div>
      )}
      
      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span className="ml-auto inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-900">
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
      
      {/* Footer */}
      {footer && (
        <div className="border-t border-gray-200 p-4">
          {footer}
        </div>
      )}
    </div>
  )
}