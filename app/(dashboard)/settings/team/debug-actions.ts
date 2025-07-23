'use server'

import { createClient } from '@/lib/supabase/server'

export async function debugTeamQuery(organizationId: string) {
  const supabase = await createClient()
  
  const results: any = {}
  
  // Test 1: Basic organization_users query
  const { data: basic, error: basicError } = await supabase
    .from('organization_users')
    .select('*')
    .eq('organization_id', organizationId)
  
  results.basicQuery = {
    data: basic,
    error: basicError?.message,
    count: basic?.length || 0
  }
  
  // Test 2: Query with users join (like the original)
  const { data: withJoin, error: joinError } = await supabase
    .from('organization_users')
    .select(`
      id,
      role,
      status,
      department,
      title,
      joined_at,
      invited_at,
      users!organization_users_user_id_fkey (
        id,
        email,
        raw_user_meta_data
      )
    `)
    .eq('organization_id', organizationId)
  
  results.withJoinQuery = {
    data: withJoin,
    error: joinError?.message,
    count: withJoin?.length || 0
  }
  
  // Test 3: Try a different join syntax
  const { data: altJoin, error: altError } = await supabase
    .from('organization_users')
    .select(`
      *,
      user:users!user_id (
        id,
        email
      )
    `)
    .eq('organization_id', organizationId)
  
  results.alternativeJoin = {
    data: altJoin,
    error: altError?.message,
    count: altJoin?.length || 0
  }
  
  // Test 4: Check if users table is accessible
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email')
    .limit(5)
  
  results.usersTable = {
    data: users,
    error: usersError?.message,
    count: users?.length || 0
  }
  
  return results
}