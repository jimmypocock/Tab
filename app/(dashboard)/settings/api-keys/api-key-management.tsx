'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Copy, MoreHorizontal, Plus, Eye, EyeOff, CheckCircle, XCircle, Clock, Key } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatDistanceToNow } from 'date-fns'

interface ApiKey {
  id: string
  name: string | null
  keyPrefix: string
  scope: string | null
  permissions: Record<string, any>
  isActive: boolean
  lastUsedAt: Date | null
  createdAt: Date
  revokedAt: Date | null
  usageCount: number
}

interface ApiKeyManagementProps {
  organizationId: string
}

export function ApiKeyManagement({ organizationId }: ApiKeyManagementProps) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newKeyData, setNewKeyData] = useState({
    name: '',
    scope: 'merchant' as 'merchant' | 'corporate' | 'full',
    environment: 'test' as 'test' | 'live',
  })
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null)
  const [showNewKey, setShowNewKey] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchApiKeys()
  }, [fetchApiKeys])

  const fetchApiKeys = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/organizations/${organizationId}/api-keys`)
      if (!response.ok) {
        throw new Error('Failed to fetch API keys')
      }
      const data = await response.json()
      setApiKeys(data.data || [])
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load API keys',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [organizationId, toast])

  const createApiKey = async () => {
    if (!newKeyData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a name for the API key',
        variant: 'destructive',
      })
      return
    }

    setCreating(true)
    try {
      const response = await fetch(`/api/v1/organizations/${organizationId}/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newKeyData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to create API key')
      }

      const data = await response.json()
      setNewlyCreatedKey(data.data.key)
      setShowNewKey(true)
      setShowCreateDialog(false)
      setNewKeyData({ name: '', scope: 'merchant', environment: 'test' })
      
      toast({
        title: 'Success',
        description: 'API key created successfully',
      })
      
      fetchApiKeys()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create API key',
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  const updateApiKey = async (keyId: string, updates: { name?: string; isActive?: boolean }) => {
    try {
      const response = await fetch(`/api/v1/organizations/${organizationId}/api-keys/${keyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to update API key')
      }

      toast({
        title: 'Success',
        description: 'API key updated successfully',
      })
      
      fetchApiKeys()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update API key',
        variant: 'destructive',
      })
    }
  }

  const revokeApiKey = async (keyId: string) => {
    try {
      const response = await fetch(`/api/v1/organizations/${organizationId}/api-keys/${keyId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to revoke API key')
      }

      toast({
        title: 'Success',
        description: 'API key revoked successfully',
      })
      
      fetchApiKeys()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to revoke API key',
        variant: 'destructive',
      })
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: 'Copied',
        description: 'API key copied to clipboard',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      })
    }
  }

  const getEnvironmentFromPrefix = (prefix: string) => {
    return prefix.includes('_test_') ? 'test' : 'live'
  }

  const getStatusBadge = (apiKey: ApiKey) => {
    if (!apiKey.isActive) {
      return <Badge variant="secondary" className="text-red-600"><XCircle className="w-3 h-3 mr-1" />Revoked</Badge>
    }
    return <Badge variant="secondary" className="text-green-600"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>
  }

  const getEnvironmentBadge = (prefix: string) => {
    const env = getEnvironmentFromPrefix(prefix)
    return env === 'live' ? (
      <Badge variant="destructive">Live</Badge>
    ) : (
      <Badge variant="secondary">Test</Badge>
    )
  }

  if (loading) {
    return <div>Loading API keys...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">API Keys ({apiKeys.length})</h3>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New API Key</DialogTitle>
              <DialogDescription>
                Create a new API key for your organization. Choose a descriptive name and select the appropriate environment.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Production API, Development Key"
                  value={newKeyData.name}
                  onChange={(e) => setNewKeyData({ ...newKeyData, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="environment">Environment</Label>
                <Select 
                  value={newKeyData.environment} 
                  onValueChange={(value: 'test' | 'live') => setNewKeyData({ ...newKeyData, environment: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="test">Test (for development)</SelectItem>
                    <SelectItem value="live">Live (for production)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="scope">Scope</Label>
                <Select 
                  value={newKeyData.scope} 
                  onValueChange={(value: 'merchant' | 'corporate' | 'full') => setNewKeyData({ ...newKeyData, scope: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="merchant">Merchant (tab management)</SelectItem>
                    <SelectItem value="corporate">Corporate (organization management)</SelectItem>
                    <SelectItem value="full">Full (all permissions)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={createApiKey} disabled={creating}>
                {creating ? 'Creating...' : 'Create API Key'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* New Key Display Dialog */}
      <Dialog open={showNewKey} onOpenChange={setShowNewKey}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              API Key Created
            </DialogTitle>
            <DialogDescription>
              Your new API key has been created. Copy it now as it won&apos;t be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                <strong>Important:</strong> This is the only time you&apos;ll see this key. Make sure to copy and store it securely.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex gap-2">
                <Textarea
                  value={newlyCreatedKey || ''}
                  readOnly
                  className="font-mono text-sm"
                  rows={3}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(newlyCreatedKey || '')}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => {
              setShowNewKey(false)
              setNewlyCreatedKey(null)
            }}>
              I&apos;ve copied the key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {apiKeys.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Key className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No API Keys</h3>
            <p className="text-muted-foreground mb-4">
              Create your first API key to start using the Tab API
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {apiKeys.map((apiKey) => (
            <Card key={apiKey.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold">{apiKey.name || 'Unnamed Key'}</h4>
                      {getStatusBadge(apiKey)}
                      {getEnvironmentBadge(apiKey.keyPrefix)}
                      <Badge variant="outline">{apiKey.scope}</Badge>
                    </div>
                    <div className="font-mono text-sm text-muted-foreground">
                      {apiKey.keyPrefix}...
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Created {formatDistanceToNow(new Date(apiKey.createdAt))} ago</span>
                      {apiKey.lastUsedAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last used {formatDistanceToNow(new Date(apiKey.lastUsedAt))} ago
                        </span>
                      )}
                      {!apiKey.lastUsedAt && (
                        <span className="text-yellow-600">Never used</span>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {apiKey.isActive ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              Revoke Key
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to revoke this API key? This action cannot be undone and will immediately stop all API requests using this key.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => revokeApiKey(apiKey.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Revoke Key
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <DropdownMenuItem 
                          onClick={() => updateApiKey(apiKey.id, { isActive: true })}
                        >
                          Reactivate Key
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}