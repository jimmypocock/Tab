'use client'

import { useState, useTransition } from 'react'
import { ChevronDownIcon, CheckIcon, BuildingIcon, ShoppingBagIcon, BriefcaseIcon } from 'lucide-react'
import { switchOrganization } from '@/app/(dashboard)/actions/organization-actions'
import { cn } from '@/lib/utils'

interface Organization {
  id: string
  name: string
  slug: string
  is_merchant: boolean
  is_corporate: boolean
}

interface OrganizationSwitcherProps {
  currentOrganization: Organization
  organizations: Organization[]
  userRole: string
}

export function OrganizationSwitcher({ 
  currentOrganization, 
  organizations, 
  userRole 
}: OrganizationSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleOrganizationSwitch = (orgId: string) => {
    if (orgId === currentOrganization.id) {
      setIsOpen(false)
      return
    }

    startTransition(async () => {
      try {
        await switchOrganization(orgId)
      } catch (error) {
        console.error('Failed to switch organization:', error)
        // In a production app, show a toast notification
      }
    })
  }

  const getOrgIcon = (org: Organization) => {
    if (org.is_merchant && org.is_corporate) {
      return <BuildingIcon className="w-4 h-4 text-blue-600" />
    }
    if (org.is_merchant) {
      return <ShoppingBagIcon className="w-4 h-4 text-green-600" />
    }
    if (org.is_corporate) {
      return <BriefcaseIcon className="w-4 h-4 text-purple-600" />
    }
    return <BuildingIcon className="w-4 h-4 text-gray-600" />
  }

  const getOrgBadge = (org: Organization) => {
    if (org.is_merchant && org.is_corporate) {
      return (
        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
          Merchant & Corporate
        </span>
      )
    }
    if (org.is_merchant) {
      return (
        <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
          Merchant
        </span>
      )
    }
    if (org.is_corporate) {
      return (
        <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
          Corporate
        </span>
      )
    }
    return null
  }

  if (organizations.length <= 1) {
    // Don't show switcher if user only has access to one organization
    return (
      <div className="mb-3 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-start gap-3">
          {getOrgIcon(currentOrganization)}
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">
              {currentOrganization.name}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500 capitalize">{userRole}</span>
              {getOrgBadge(currentOrganization)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative mb-3">
      <button
        type="button"
        className={cn(
          "w-full flex items-center justify-between p-3 text-sm font-medium text-gray-900 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all",
          isPending && "opacity-75 cursor-wait"
        )}
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
      >
        <div className="flex items-start gap-3 flex-1">
          {getOrgIcon(currentOrganization)}
          <div className="text-left">
            <div className="font-medium">{currentOrganization.name}</div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
              <span className="capitalize">{userRole}</span>
              {getOrgBadge(currentOrganization)}
            </div>
          </div>
        </div>
        <ChevronDownIcon 
          className={cn(
            "w-4 h-4 text-gray-400 transition-transform",
            isOpen && "rotate-180"
          )} 
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-60 overflow-y-auto">
            <div className="p-2">
              <p className="text-xs text-gray-500 px-3 py-1">Switch organization</p>
            </div>
            <div className="border-t border-gray-100">
              {organizations.map((org) => {
                const isSelected = org.id === currentOrganization.id
                
                return (
                  <button
                    key={org.id}
                    type="button"
                    className={cn(
                      "w-full flex items-center justify-between p-3 text-sm hover:bg-gray-50 transition-colors",
                      isSelected && "bg-blue-50 hover:bg-blue-50"
                    )}
                    onClick={() => handleOrganizationSwitch(org.id)}
                    disabled={isPending}
                  >
                    <div className="flex items-start gap-3 flex-1">
                      {getOrgIcon(org)}
                      <div className="text-left">
                        <div className={cn(
                          "font-medium",
                          isSelected ? "text-blue-900" : "text-gray-900"
                        )}>
                          {org.name}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                          <span>@{org.slug}</span>
                          {getOrgBadge(org)}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <CheckIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
            <div className="border-t border-gray-100 p-2">
              <a
                href="/organizations/new"
                className="block w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
              >
                + Create new organization
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  )
}