import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OrganizationService } from '@/lib/services/organization.service'
import { ApiKeyManagement } from './api-key-management'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, Key, AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default async function ApiKeysPage() {
  const supabase = await createClient()
  
  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Get user's organization
  const { organization } = await OrganizationService.getCurrentOrganization(user.id)
  if (!organization) {
    redirect('/onboarding')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Key className="h-8 w-8" />
          API Keys
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage API keys for your organization to access the Tab API programmatically.
        </p>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          API keys provide full access to your organization&apos;s data. Keep them secure and never share them publicly.
          Only administrators can create and manage API keys.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Create and manage API keys for your organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<div>Loading API keys...</div>}>
                <ApiKeyManagement organizationId={organization.id} />
              </Suspense>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Security Best Practices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 mt-0.5 text-green-600" />
                <div>
                  <p className="font-medium">Keep keys secure</p>
                  <p className="text-muted-foreground">Never commit API keys to version control or share them publicly.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 text-yellow-600" />
                <div>
                  <p className="font-medium">Rotate regularly</p>
                  <p className="text-muted-foreground">Generate new keys periodically and revoke old ones.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <Key className="h-4 w-4 mt-0.5 text-blue-600" />
                <div>
                  <p className="font-medium">Use test keys</p>
                  <p className="text-muted-foreground">Use test environment keys during development.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Key Types</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-medium text-green-600">org_test_*</p>
                <p className="text-muted-foreground">Test environment keys for development</p>
              </div>
              
              <div>
                <p className="font-medium text-red-600">org_live_*</p>
                <p className="text-muted-foreground">Production keys for live transactions</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}