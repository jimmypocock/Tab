'use server'

import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'
import { generateApiKey } from '@/lib/api/keys'
import { revalidatePath } from 'next/cache'

export async function createNewApiKey(name: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }
  
  // Get user's current organization
  const { data: userOrganizations } = await supabase
    .from('organization_users')
    .select(`
      organizations (id)
    `)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
  
  const organizationId = userOrganizations?.[0]?.organizations?.id
  if (!organizationId) {
    return { error: 'No organization found' }
  }
  
  // Generate a unique API key
  let apiKey: string
  let keyHash: string
  let attempts = 0
  const maxAttempts = 5
  
  while (attempts < maxAttempts) {
    // In development, always create test keys
    const environment = process.env.NODE_ENV === 'development' ? 'test' : 'live'
    apiKey = generateApiKey(environment)
    keyHash = createHash('sha256').update(apiKey).digest('hex')
    
    // Check if this hash already exists
    const { data: existing } = await supabase
      .from('api_keys')
      .select('id')
      .eq('key_hash', keyHash)
      .single()
    
    if (!existing) {
      break
    }
    
    attempts++
  }
  
  if (attempts === maxAttempts) {
    return { error: 'Failed to generate unique API key' }
  }
  
  const keyPrefix = apiKey!.substring(0, 8)
  
  const { error } = await supabase
    .from('api_keys')
    .insert({
      organization_id: organizationId,
      key_hash: keyHash!,
      key_prefix: keyPrefix,
      name: name,
      is_active: true,
    })
  
  if (error) {
    console.error('Failed to create API key:', error)
    return { error: `Failed to create API key: ${error.message}` }
  }
  
  revalidatePath('/settings')
  return { apiKey: apiKey! }
}

export async function deleteApiKey(keyId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Not authenticated' }
  }
  
  // Get user's current organization
  const { data: userOrganizations } = await supabase
    .from('organization_users')
    .select(`
      organizations (id)
    `)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
  
  const organizationId = userOrganizations?.[0]?.organizations?.id
  if (!organizationId) {
    return { error: 'No organization found' }
  }
  
  const { error } = await supabase
    .from('api_keys')
    .update({ is_active: false })
    .eq('id', keyId)
    .eq('organization_id', organizationId)
  
  if (error) {
    return { error: 'Failed to delete API key' }
  }
  
  revalidatePath('/settings')
  return { success: true }
}

export async function getApiKeys() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return []
  }
  
  // Get user's current organization
  const { data: userOrganizations } = await supabase
    .from('organization_users')
    .select(`
      organizations (id)
    `)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
  
  const organizationId = userOrganizations?.[0]?.organizations?.id
  if (!organizationId) {
    return []
  }
  
  const { data } = await supabase
    .from('api_keys')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  
  return data || []
}