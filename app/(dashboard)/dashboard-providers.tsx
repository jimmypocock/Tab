'use client'

import { OrganizationProvider } from '@/components/dashboard/organization-context'

interface DashboardProvidersProps {
  children: React.ReactNode
  currentOrganization: any
  userRole: 'owner' | 'admin' | 'member' | 'viewer'
  organizations: any[]
}

// Only dashboard-specific providers go here
// Global providers (Toast, QueryClient) are now in app/providers.tsx
export function DashboardProviders({ 
  children, 
  currentOrganization,
  userRole,
  organizations
}: DashboardProvidersProps) {
  return (
    <OrganizationProvider
      currentOrganization={currentOrganization}
      userRole={userRole}
      organizations={organizations}
    >
      {children}
    </OrganizationProvider>
  )
}