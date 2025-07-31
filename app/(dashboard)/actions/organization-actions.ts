'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const SELECTED_ORG_COOKIE = 'selected-organization-id'

export async function switchOrganization(organizationId: string) {
  const supabase = await createClient()
  
  // Verify the user has access to this organization
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data: membership } = await supabase
    .from('organization_users')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .single()

  if (!membership) {
    throw new Error('You do not have access to this organization')
  }

  // Store the preference in a cookie
  const cookieStore = await cookies()
  cookieStore.set(SELECTED_ORG_COOKIE, organizationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })

  // Redirect to refresh the page with new organization context
  redirect('/dashboard')
}

export async function getSelectedOrganizationId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(SELECTED_ORG_COOKIE)?.value || null
}