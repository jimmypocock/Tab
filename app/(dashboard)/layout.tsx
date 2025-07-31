import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Home, FileText, CreditCard, Settings, LogOut, Users } from 'lucide-react'
import { DashboardProviders } from './dashboard-providers'
import { OrganizationSwitcher } from '@/components/dashboard/organization-switcher'
import { getSelectedOrganizationId } from './actions/organization-actions'

async function signOut() {
  'use server'
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Get user's organizations
  const { data: userOrganizations, error: orgError } = await supabase
    .from('organization_users')
    .select(`
      role,
      status,
      organizations (
        id,
        name,
        slug,
        is_merchant,
        is_corporate
      )
    `)
    .eq('user_id', user.id)
    .eq('status', 'active')

  // Check if user has any organizations
  if (!userOrganizations || userOrganizations.length === 0) {
    // This should never happen - the trigger should create an org on signup
    // If we're here, there's a serious issue with the database trigger
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 text-center">
          <div>
            <h2 className="text-3xl font-extrabold text-gray-900">
              Critical: User has no organization
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              This indicates a database trigger failure. Please check the logs.
            </p>
            <p className="mt-4 text-xs text-gray-500">
              User: {user.email} (ID: {user.id})
            </p>
            <div className="mt-6">
              <form action={signOut}>
                <button
                  type="submit"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Get the user's selected organization from cookie
  const selectedOrgId = await getSelectedOrganizationId()
  
  // Find the selected organization or default to the first one
  let currentOrganizationData = selectedOrgId
    ? userOrganizations.find(org => org.organizations?.id === selectedOrgId)
    : null
    
  // If selected org not found (user may have lost access), use the first one
  if (!currentOrganizationData) {
    currentOrganizationData = userOrganizations[0]
  }
    
  if (!currentOrganizationData?.organizations) {
    // This is also an error case - the join should always return the organization
    console.error('Critical: Organization data missing from join', { userId: user.id })
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Configuration Error</h2>
          <p className="mt-2 text-gray-600">Please contact support.</p>
        </div>
      </div>
    )
  }
  
  const currentOrganization = currentOrganizationData.organizations
  const userRole = currentOrganizationData.role
  
  // Extract organization list for the switcher
  const organizations = userOrganizations
    .map(org => org.organizations)
    .filter(Boolean)

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Tabs', href: '/tabs', icon: FileText },
    { name: 'Invoices', href: '/invoices', icon: CreditCard },
    { name: 'Settings', href: '/settings', icon: Settings },
    { name: 'Team', href: '/settings/team', icon: Users },
    { name: 'Payment Processors', href: '/settings/processors', icon: CreditCard },
  ]

  return (
    <DashboardProviders 
      currentOrganization={currentOrganization}
      userRole={userRole}
      organizations={organizations}
    >
      <div className="min-h-screen bg-gray-50">
        {/* Sidebar */}
        <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-center border-b">
            <h1 className="text-2xl font-bold text-blue-600">Tab</h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-2 py-4">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              >
                <item.icon
                  className="mr-3 h-5 w-5 flex-shrink-0 text-gray-400 group-hover:text-gray-500"
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            ))}
          </nav>

          {/* User info and sign out */}
          <div className="border-t p-4">
            <OrganizationSwitcher
              currentOrganization={currentOrganization}
              organizations={organizations}
              userRole={userRole}
            />
            <div className="mb-3">
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="group flex w-full items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              >
                <LogOut
                  className="mr-3 h-5 w-5 flex-shrink-0 text-gray-400 group-hover:text-gray-500"
                  aria-hidden="true"
                />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="pl-64">
        <main className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
    </DashboardProviders>
  )
}