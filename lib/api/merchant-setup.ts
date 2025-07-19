import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'
import { generateApiKey } from '@/lib/api/keys'

/**
 * Creates a merchant with an initial API key
 * This ensures every merchant has at least one API key for immediate use
 */
export async function setupMerchantWithApiKey(
  userId: string,
  email: string,
  businessName: string
): Promise<{ success: boolean; error?: string; apiKey?: string }> {
  const supabase = await createClient()
  
  try {
    // Start a transaction-like operation
    // First, create the merchant
    const { error: merchantError } = await supabase
      .from('merchants')
      .insert({
        id: userId,
        email,
        business_name: businessName,
      })
    
    if (merchantError) {
      console.error('Failed to create merchant:', merchantError)
      return { success: false, error: 'Failed to create merchant account' }
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
        merchant_id: userId,
        key_hash: keyHash!,
        key_prefix: keyPrefix,
        name: 'Default API Key',
        is_active: true,
      })
    
    if (keyError) {
      console.error('Failed to create API key:', keyError)
      // Clean up merchant if API key creation fails
      await supabase.from('merchants').delete().eq('id', userId)
      return { success: false, error: 'Failed to create API key' }
    }
    
    return { success: true, apiKey: apiKey! }
  } catch (error) {
    console.error('Unexpected error in setupMerchantWithApiKey:', error)
    // Attempt cleanup
    await supabase.from('merchants').delete().eq('id', userId)
    return { success: false, error: 'An unexpected error occurred' }
  }
}