'use client'

import { ToastProvider } from '@/lib/toast/toast-context'
import { OrganizationProvider } from '@/components/dashboard/organization-context'

interface DashboardProvidersProps {
  children: React.ReactNode
  currentOrganization: any
  userRole: 'owner' | 'admin' | 'member' | 'viewer'
  organizations: any[]
}

export function DashboardProviders({ 
  children, 
  currentOrganization,
  userRole,
  organizations
}: DashboardProvidersProps) {
  return (
    <ToastProvider>
      <OrganizationProvider
        currentOrganization={currentOrganization}
        userRole={userRole}
        organizations={organizations}
      >
        {children}
      </OrganizationProvider>
    </ToastProvider>
  )
}