import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OrganizationService } from '@/lib/services/organization.service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Settings, Key, Users, CreditCard, Shield, Zap } from 'lucide-react'
import Link from 'next/link'

export default async function SettingsPage() {
  const supabase = await createClient()
  
  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Get user's organization
  const { organization, userRole } = await OrganizationService.getCurrentOrganization(user.id)
  if (!organization) {
    redirect('/onboarding')
  }

  const settingsCategories = [
    {
      title: 'API Keys',
      description: 'Manage API keys for programmatic access',
      icon: Key,
      href: '/settings/api-keys',
      adminOnly: true,
    },
    {
      title: 'Team Management',
      description: 'Manage team members and permissions',
      icon: Users,
      href: '/settings/team',
      adminOnly: false,
    },
    {
      title: 'Payment Processors',
      description: 'Configure Stripe, Square, and other processors',
      icon: CreditCard,
      href: '/settings/processors',
      adminOnly: true,
    },
    {
      title: 'Security',
      description: 'Security settings and audit logs',
      icon: Shield,
      href: '/settings/security',
      adminOnly: true,
      comingSoon: true,
    },
    {
      title: 'Webhooks',
      description: 'Manage webhook endpoints and events',
      icon: Zap,
      href: '/settings/webhooks',
      adminOnly: true,
      comingSoon: true,
    },
  ]

  const isAdmin = ['owner', 'admin'].includes(userRole)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-8 w-8" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your organization settings and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingsCategories.map((category) => {
          const Icon = category.icon
          const canAccess = !category.adminOnly || isAdmin
          
          return (
            <Card key={category.title} className={!canAccess ? 'opacity-50' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  {category.title}
                  {category.comingSoon && (
                    <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded">
                      Coming Soon
                    </span>
                  )}
                </CardTitle>
                <CardDescription>{category.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {canAccess && !category.comingSoon ? (
                  <Button asChild className="w-full">
                    <Link href={category.href}>
                      Configure
                    </Link>
                  </Button>
                ) : (
                  <Button disabled className="w-full">
                    {!canAccess ? 'Admin Only' : 'Coming Soon'}
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization Information</CardTitle>
          <CardDescription>Your current organization details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Organization Name</p>
              <p className="text-sm">{organization.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Your Role</p>
              <p className="text-sm capitalize">{userRole}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Organization Type</p>
              <p className="text-sm capitalize">{organization.type}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Created</p>
              <p className="text-sm">{new Date(organization.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}