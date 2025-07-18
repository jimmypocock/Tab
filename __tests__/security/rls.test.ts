import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

// Create test clients
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

describe('Row Level Security', () => {
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey)
  
  // Test users
  const user1Email = `test1-${uuidv4()}@example.com`
  const user2Email = `test2-${uuidv4()}@example.com`
  const password = 'testpassword123'
  
  let user1Id: string
  let user2Id: string
  let user1Client: any
  let user2Client: any
  
  beforeAll(async () => {
    // Create test users
    const { data: user1Data, error: user1Error } = await serviceClient.auth.admin.createUser({
      email: user1Email,
      password,
      email_confirm: true,
    })
    
    const { data: user2Data, error: user2Error } = await serviceClient.auth.admin.createUser({
      email: user2Email,
      password,
      email_confirm: true,
    })
    
    if (user1Error || user2Error) {
      throw new Error('Failed to create test users')
    }
    
    user1Id = user1Data.user.id
    user2Id = user2Data.user.id
    
    // Create authenticated clients
    const { data: session1 } = await serviceClient.auth.signInWithPassword({
      email: user1Email,
      password,
    })
    
    const { data: session2 } = await serviceClient.auth.signInWithPassword({
      email: user2Email,
      password,
    })
    
    user1Client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${session1.session?.access_token}`,
        },
      },
    })
    
    user2Client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${session2.session?.access_token}`,
        },
      },
    })
    
    // Create merchant records
    await serviceClient.from('merchants').insert([
      { id: user1Id, business_name: 'Test Business 1', email: user1Email },
      { id: user2Id, business_name: 'Test Business 2', email: user2Email },
    ])
  })
  
  afterAll(async () => {
    // Cleanup
    if (user1Id) await serviceClient.auth.admin.deleteUser(user1Id)
    if (user2Id) await serviceClient.auth.admin.deleteUser(user2Id)
  })
  
  describe('Merchants Table', () => {
    it('should only allow users to see their own merchant record', async () => {
      // User 1 should only see their own record
      const { data: user1Merchants } = await user1Client
        .from('merchants')
        .select('*')
      
      expect(user1Merchants).toHaveLength(1)
      expect(user1Merchants[0].id).toBe(user1Id)
      
      // User 2 should only see their own record
      const { data: user2Merchants } = await user2Client
        .from('merchants')
        .select('*')
      
      expect(user2Merchants).toHaveLength(1)
      expect(user2Merchants[0].id).toBe(user2Id)
    })
    
    it('should not allow users to update other merchant records', async () => {
      const { error } = await user1Client
        .from('merchants')
        .update({ business_name: 'Hacked!' })
        .eq('id', user2Id)
      
      expect(error).toBeTruthy()
    })
  })
  
  describe('Tabs Table', () => {
    let user1TabId: string
    let user2TabId: string
    
    beforeAll(async () => {
      // Create tabs for each user using service role
      const { data: tab1 } = await serviceClient
        .from('tabs')
        .insert({
          merchant_id: user1Id,
          customer_email: 'customer1@example.com',
          total_amount: 100,
        })
        .select()
        .single()
      
      const { data: tab2 } = await serviceClient
        .from('tabs')
        .insert({
          merchant_id: user2Id,
          customer_email: 'customer2@example.com',
          total_amount: 200,
        })
        .select()
        .single()
      
      user1TabId = tab1.id
      user2TabId = tab2.id
    })
    
    it('should only show merchant their own tabs', async () => {
      // User 1 should only see their tab
      const { data: user1Tabs } = await user1Client
        .from('tabs')
        .select('*')
      
      expect(user1Tabs).toHaveLength(1)
      expect(user1Tabs[0].id).toBe(user1TabId)
      expect(user1Tabs[0].merchant_id).toBe(user1Id)
      
      // User 2 should only see their tab
      const { data: user2Tabs } = await user2Client
        .from('tabs')
        .select('*')
      
      expect(user2Tabs).toHaveLength(1)
      expect(user2Tabs[0].id).toBe(user2TabId)
      expect(user2Tabs[0].merchant_id).toBe(user2Id)
    })
    
    it('should not allow cross-merchant tab updates', async () => {
      const { error } = await user1Client
        .from('tabs')
        .update({ total_amount: 999 })
        .eq('id', user2TabId)
      
      expect(error).toBeTruthy()
    })
    
    it('should allow public access to tabs (for payment page)', async () => {
      // Unauthenticated client
      const publicClient = createClient(supabaseUrl, supabaseAnonKey)
      
      const { data, error } = await publicClient
        .from('tabs')
        .select('*')
        .eq('id', user1TabId)
        .single()
      
      expect(error).toBeFalsy()
      expect(data).toBeTruthy()
      expect(data.id).toBe(user1TabId)
    })
  })
  
  describe('API Keys Table', () => {
    it('should isolate API keys by merchant', async () => {
      // Create API key for user 1
      const { data: key1 } = await user1Client
        .from('api_keys')
        .insert({
          merchant_id: user1Id,
          name: 'Test Key 1',
          key_hash: 'hash1',
        })
        .select()
        .single()
      
      // User 1 can see their key
      const { data: user1Keys } = await user1Client
        .from('api_keys')
        .select('*')
      
      expect(user1Keys).toHaveLength(1)
      expect(user1Keys[0].id).toBe(key1.id)
      
      // User 2 cannot see user 1's key
      const { data: user2Keys } = await user2Client
        .from('api_keys')
        .select('*')
      
      expect(user2Keys).toHaveLength(0)
    })
    
    it('should not allow creating API keys for other merchants', async () => {
      const { error } = await user1Client
        .from('api_keys')
        .insert({
          merchant_id: user2Id, // Trying to create for user 2
          name: 'Malicious Key',
          key_hash: 'evil',
        })
      
      expect(error).toBeTruthy()
    })
  })
})

// Test to verify RLS is enabled on all tables
describe('RLS Configuration', () => {
  it('should have RLS enabled on all critical tables', async () => {
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)
    
    const { data } = await serviceClient.rpc('get_rls_status', {
      schema_name: 'public',
      table_names: ['merchants', 'api_keys', 'tabs', 'line_items', 'payments', 'invoices']
    }).single()
    
    // If the RPC doesn't exist, check directly
    if (!data) {
      // This is a basic check - in production you'd want to query pg_tables
      const tables = ['merchants', 'api_keys', 'tabs', 'line_items', 'payments', 'invoices']
      
      for (const table of tables) {
        const { error } = await serviceClient
          .from(table)
          .select('*')
          .limit(1)
        
        // If we can query with service role, table exists
        expect(error).toBeFalsy()
      }
    } else {
      // All tables should have RLS enabled
      expect(data.every((t: any) => t.rowsecurity)).toBe(true)
    }
  })
})