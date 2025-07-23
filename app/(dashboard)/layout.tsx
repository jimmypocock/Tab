import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Home, FileText, CreditCard, Settings, LogOut, Users } from 'lucide-react'
import { DashboardProviders } from './dashboard-providers'
import { OrganizationSwitcher } from '@/components/dashboard/organization-switcher'

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
  const { data: userOrganizations } = await supabase
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
    redirect('/settings/setup-organization')
  }

  // For now, just use the first organization
  // In a production app, you might want to store user preference in database
  // or implement a more sophisticated organization selection mechanism
  const currentOrganizationData = userOrganizations[0]
    
  if (!currentOrganizationData?.organizations) {
    redirect('/settings/setup-organization')
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
    <DashboardProviders>
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