'use client'

import { createContext, useContext } from 'react'

interface Organization {
  id: string
  name: string
  slug: string
  is_merchant: boolean
  is_corporate: boolean
}

interface OrganizationContextType {
  currentOrganization: Organization | null
  userRole: 'owner' | 'admin' | 'member' | 'viewer'
  organizations: Organization[]
}

const OrganizationContext = createContext<OrganizationContextType | null>(null)

export function OrganizationProvider({ 
  children,
  currentOrganization,
  userRole,
  organizations
}: { 
  children: React.ReactNode
  currentOrganization: Organization
  userRole: 'owner' | 'admin' | 'member' | 'viewer'
  organizations: Organization[]
}) {
  return (
    <OrganizationContext.Provider 
      value={{ 
        currentOrganization,
        userRole,
        organizations
      }}
    >
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider')
  }
  return context
}