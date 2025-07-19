'use server'

import { createClient } from '@/lib/supabase/server'
import { setupMerchantWithApiKey } from '@/lib/api/merchant-setup'
import { redirect } from 'next/navigation'

export async function registerWithApiKey(
  email: string,
  password: string,
  businessName: string
): Promise<{ success: boolean; error?: string; apiKey?: string }> {
  const supabase = await createClient()
  
  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        business_name: businessName,
      },
    },
  })
  
  if (authError) {
    return { success: false, error: authError.message }
  }
  
  if (!authData.user) {
    return { success: false, error: 'Failed to create user' }
  }
  
  // Set up merchant with API key
  const result = await setupMerchantWithApiKey(
    authData.user.id,
    email,
    businessName
  )
  
  if (!result.success) {
    // Clean up auth user if merchant setup fails
    const adminClient = await createClient()
    await adminClient.auth.admin.deleteUser(authData.user.id)
    return result
  }
  
  // Store API key in session for one-time display
  const { error: sessionError } = await supabase
    .from('temp_api_keys')
    .insert({
      user_id: authData.user.id,
      api_key: result.apiKey,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
    })
  
  if (sessionError) {
    console.error('Failed to store temporary API key:', sessionError)
  }
  
  redirect('/dashboard?newUser=true')
}