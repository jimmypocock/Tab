'use client'

import { useState } from 'react'
import { ChevronDownIcon, CheckIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'

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
  const router = useRouter()

  const handleOrganizationSwitch = async (orgId: string) => {
    // Set organization ID in localStorage for persistence
    localStorage.setItem('selectedOrganizationId', orgId)
    
    // Close dropdown
    setIsOpen(false)
    
    // Refresh the page to load new organization context
    // In a more sophisticated app, you might use a context provider instead
    window.location.reload()
  }

  if (organizations.length <= 1) {
    // Don't show switcher if user only has access to one organization
    return (
      <div className="mb-3">
        <p className="text-sm font-medium text-gray-900">
          {currentOrganization.name}
        </p>
        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
          <span className="capitalize">{userRole}</span>
          {currentOrganization.is_merchant && currentOrganization.is_corporate && (
            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
              Merchant & Corporate
            </span>
          )}
          {currentOrganization.is_merchant && !currentOrganization.is_corporate && (
            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
              Merchant
            </span>
          )}
          {!currentOrganization.is_merchant && currentOrganization.is_corporate && (
            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
              Corporate
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="relative mb-3">
      <button
        type="button"
        className="w-full flex items-center justify-between p-2 text-sm font-medium text-gray-900 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex-1 text-left">
          <div className="font-medium">{currentOrganization.name}</div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
            <span className="capitalize">{userRole}</span>
            {currentOrganization.is_merchant && currentOrganization.is_corporate && (
              <span className="px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                M&C
              </span>
            )}
            {currentOrganization.is_merchant && !currentOrganization.is_corporate && (
              <span className="px-1 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                M
              </span>
            )}
            {!currentOrganization.is_merchant && currentOrganization.is_corporate && (
              <span className="px-1 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                C
              </span>
            )}
          </div>
        </div>
        <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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
            {organizations.map((org) => (
              <button
                key={org.id}
                type="button"
                className="w-full flex items-center justify-between p-3 text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors"
                onClick={() => handleOrganizationSwitch(org.id)}
              >
                <div className="flex-1 text-left">
                  <div className="font-medium text-gray-900">{org.name}</div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                    <span>@{org.slug}</span>
                    {org.is_merchant && org.is_corporate && (
                      <span className="px-1 py-0.5 bg-blue-100 text-blue-700 rounded">
                        Merchant & Corporate
                      </span>
                    )}
                    {org.is_merchant && !org.is_corporate && (
                      <span className="px-1 py-0.5 bg-green-100 text-green-700 rounded">
                        Merchant
                      </span>
                    )}
                    {!org.is_merchant && org.is_corporate && (
                      <span className="px-1 py-0.5 bg-purple-100 text-purple-700 rounded">
                        Corporate
                      </span>
                    )}
                  </div>
                </div>
                {org.id === currentOrganization.id && (
                  <CheckIcon className="w-4 h-4 text-blue-600" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}