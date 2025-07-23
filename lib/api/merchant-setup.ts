import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'
import { generateApiKey } from '@/lib/api/keys'
import { OrganizationService } from '@/lib/services/organization.service'

/**
 * Creates an organization with an initial API key
 * This ensures every organization has at least one API key for immediate use
 * 
 * @deprecated Function name is misleading - it creates organizations, not merchants
 * TODO: Rename to setupOrganizationWithApiKey in next major version
 */
export async function setupMerchantWithApiKey(
  userId: string,
  email: string,
  businessName: string
): Promise<{ success: boolean; error?: string; apiKey?: string }> {
  const supabase = await createClient()
  
  try {
    // Create organization with user as owner
    const organization = await OrganizationService.createOrganization({
      name: businessName,
      slug: businessName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'),
      type: 'business',
      isMerchant: true,
      isCorporate: false,
      primaryEmail: email,
      settings: {},
      createdBy: userId,
    })
    
    if (!organization) {
      return { success: false, error: 'Failed to create organization' }
    }
    
    // Generate a unique API key
    let apiKey: string
    let keyHash: string
    let attempts = 0
    const maxAttempts = 5
    
    // Retry logic to ensure uniqueness
    while (attempts < maxAttempts) {
      apiKey = generateApiKey()
      keyHash = createHash('sha256').update(apiKey).digest('hex')
      
      // Check if this hash already exists
      const { data: existing } = await supabase
        .from('api_keys')
        .select('id')
        .eq('key_hash', keyHash)
        .single()
      
      if (!existing) {
        // Key is unique, we can use it
        break
      }
      
      attempts++
    }
    
    if (attempts === maxAttempts) {
      // Clean up merchant if we can't create a unique key
      await supabase.from('merchants').delete().eq('id', userId)
      return { success: false, error: 'Failed to generate unique API key' }
    }
    
    // Create the API key
    const keyPrefix = apiKey!.substring(0, 8)
    const { error: keyError } = await supabase
      .from('api_keys')
      .insert({
        organization_id: organization.id,
        key_hash: keyHash!,
        key_prefix: keyPrefix,
        name: 'Default API Key',
        scope: 'full',
        is_active: true,
      })
    
    if (keyError) {
      console.error('Failed to create API key:', keyError)
      // Clean up organization if API key creation fails
      await supabase.from('organizations').delete().eq('id', organization.id)
      return { success: false, error: 'Failed to create API key' }
    }
    
    return { success: true, apiKey: apiKey! }
  } catch (error) {
    console.error('Unexpected error in setupMerchantWithApiKey:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}