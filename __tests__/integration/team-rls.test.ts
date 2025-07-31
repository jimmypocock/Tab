/**
 * Integration tests for team RLS policies
 * These tests verify that Row Level Security policies work correctly
 * 
 * @jest-environment node
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@supabase/supabase-js'

describe('Team RLS Integration Tests', () => {
  let supabase: any
  let testOrganizationId: string
  let ownerId: string
  let adminId: string
  let memberId: string
  let viewerId: string
  let outsiderId: string

  beforeAll(async () => {
    // Skip if not in test environment
    if (process.env.NODE_ENV !== 'test' && !process.env.RUN_INTEGRATION_TESTS) {
      console.log('Skipping integration tests - set RUN_INTEGRATION_TESTS=true to run')
      return
    }

    supabase = createAdminClient()
    
    // Create test organization and users
    const { data: owner } = await supabase.auth.admin.createUser({
      email: 'rls-owner@test.com',
      password: 'test123',
      email_confirm: true,
    })
    ownerId = owner.user.id

    const { data: admin } = await supabase.auth.admin.createUser({
      email: 'rls-admin@test.com',
      password: 'test123',
      email_confirm: true,
    })
    adminId = admin.user.id

    const { data: member } = await supabase.auth.admin.createUser({
      email: 'rls-member@test.com',
      password: 'test123',
      email_confirm: true,
    })
    memberId = member.user.id

    const { data: viewer } = await supabase.auth.admin.createUser({
      email: 'rls-viewer@test.com',
      password: 'test123',
      email_confirm: true,
    })
    viewerId = viewer.user.id

    const { data: outsider } = await supabase.auth.admin.createUser({
      email: 'rls-outsider@test.com',
      password: 'test123',
      email_confirm: true,
    })
    outsiderId = outsider.user.id

    // Create users records
    await supabase.from('users').insert([
      { id: ownerId, email: 'rls-owner@test.com' },
      { id: adminId, email: 'rls-admin@test.com' },
      { id: memberId, email: 'rls-member@test.com' },
      { id: viewerId, email: 'rls-viewer@test.com' },
      { id: outsiderId, email: 'rls-outsider@test.com' },
    ])

    // Create test organization
    const { data: org } = await supabase
      .from('organizations')
      .insert({
        name: 'RLS Test Organization',
        slug: 'rls-test-org',
        is_merchant: true,
        created_by: ownerId,
      })
      .select()
      .single()

    testOrganizationId = org.id

    // Add team members
    await supabase.from('organization_users').insert([
      { organization_id: testOrganizationId, user_id: ownerId, role: 'owner', status: 'active' },
      { organization_id: testOrganizationId, user_id: adminId, role: 'admin', status: 'active' },
      { organization_id: testOrganizationId, user_id: memberId, role: 'member', status: 'active' },
      { organization_id: testOrganizationId, user_id: viewerId, role: 'viewer', status: 'active' },
    ])

    // Create a pending invitation
    await supabase.from('invitation_tokens').insert({
      organization_id: testOrganizationId,
      email: 'pending@test.com',
      role: 'member',
      invited_by: ownerId,
      token: 'test-token-123',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
  })

  afterAll(async () => {
    if (supabase && testOrganizationId) {
      // Cleanup
      await supabase.from('organizations').delete().eq('id', testOrganizationId)
      await supabase.auth.admin.deleteUser(ownerId)
      await supabase.auth.admin.deleteUser(adminId)
      await supabase.auth.admin.deleteUser(memberId)
      await supabase.auth.admin.deleteUser(viewerId)
      await supabase.auth.admin.deleteUser(outsiderId)
    }
  })

  describe('Organization Users Visibility', () => {
    it('member should see all team members of their organization', async () => {
      if (!process.env.RUN_INTEGRATION_TESTS) return

      const memberClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      await memberClient.auth.signInWithPassword({
        email: 'rls-member@test.com',
        password: 'test123',
      })

      const { data: members, error } = await memberClient
        .from('organization_users')
        .select('*, user:users!user_id(email)')
        .eq('organization_id', testOrganizationId)

      expect(error).toBeNull()
      expect(members).toHaveLength(4)
      
      const emails = members?.map(m => m.user?.email).sort()
      expect(emails).toEqual([
        'rls-admin@test.com',
        'rls-member@test.com',
        'rls-owner@test.com',
        'rls-viewer@test.com',
      ])
    })

    it('outsider should not see any team members', async () => {
      if (!process.env.RUN_INTEGRATION_TESTS) return

      const outsiderClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      await outsiderClient.auth.signInWithPassword({
        email: 'rls-outsider@test.com',
        password: 'test123',
      })

      const { data: members, error } = await outsiderClient
        .from('organization_users')
        .select('*')
        .eq('organization_id', testOrganizationId)

      expect(error).toBeNull()
      expect(members).toHaveLength(0)
    })
  })

  describe('Invitation Visibility', () => {
    it('admin should see pending invitations', async () => {
      if (!process.env.RUN_INTEGRATION_TESTS) return

      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      await adminClient.auth.signInWithPassword({
        email: 'rls-admin@test.com',
        password: 'test123',
      })

      const { data: invitations, error } = await adminClient
        .from('invitation_tokens')
        .select('email, role')
        .eq('organization_id', testOrganizationId)
        .is('accepted_at', null)

      expect(error).toBeNull()
      expect(invitations).toHaveLength(1)
      expect(invitations?.[0].email).toBe('pending@test.com')
    })

    it('member should not see pending invitations', async () => {
      if (!process.env.RUN_INTEGRATION_TESTS) return

      const memberClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      await memberClient.auth.signInWithPassword({
        email: 'rls-member@test.com',
        password: 'test123',
      })

      const { data: invitations, error } = await memberClient
        .from('invitation_tokens')
        .select('email, role')
        .eq('organization_id', testOrganizationId)
        .is('accepted_at', null)

      expect(error).toBeNull()
      expect(invitations).toHaveLength(0)
    })

    it('viewer should not see pending invitations', async () => {
      if (!process.env.RUN_INTEGRATION_TESTS) return

      const viewerClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      await viewerClient.auth.signInWithPassword({
        email: 'rls-viewer@test.com',
        password: 'test123',
      })

      const { data: invitations, error } = await viewerClient
        .from('invitation_tokens')
        .select('email, role')
        .eq('organization_id', testOrganizationId)
        .is('accepted_at', null)

      expect(error).toBeNull()
      expect(invitations).toHaveLength(0)
    })
  })

  describe('Cross-Organization Isolation', () => {
    let otherOrganizationId: string
    let otherOrgUserId: string

    beforeAll(async () => {
      if (!process.env.RUN_INTEGRATION_TESTS) return

      // Create another organization with different user
      const { data: otherUser } = await supabase.auth.admin.createUser({
        email: 'other-org-user@test.com',
        password: 'test123',
        email_confirm: true,
      })
      otherOrgUserId = otherUser.user.id

      await supabase.from('users').insert({
        id: otherOrgUserId,
        email: 'other-org-user@test.com',
      })

      const { data: otherOrg } = await supabase
        .from('organizations')
        .insert({
          name: 'Other Organization',
          slug: 'other-org',
          is_merchant: true,
          created_by: otherOrgUserId,
        })
        .select()
        .single()

      otherOrganizationId = otherOrg.id

      await supabase.from('organization_users').insert({
        organization_id: otherOrganizationId,
        user_id: otherOrgUserId,
        role: 'owner',
        status: 'active',
      })
    })

    afterAll(async () => {
      if (supabase && otherOrganizationId) {
        await supabase.from('organizations').delete().eq('id', otherOrganizationId)
        await supabase.auth.admin.deleteUser(otherOrgUserId)
      }
    })

    it('users should not see members from other organizations', async () => {
      if (!process.env.RUN_INTEGRATION_TESTS) return

      const memberClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      await memberClient.auth.signInWithPassword({
        email: 'rls-member@test.com',
        password: 'test123',
      })

      // Try to query the other organization's members
      const { data: otherOrgMembers, error } = await memberClient
        .from('organization_users')
        .select('*')
        .eq('organization_id', otherOrganizationId)

      expect(error).toBeNull()
      expect(otherOrgMembers).toHaveLength(0)

      // Verify they can still see their own org
      const { data: ownOrgMembers } = await memberClient
        .from('organization_users')
        .select('*')
        .eq('organization_id', testOrganizationId)

      expect(ownOrgMembers).toHaveLength(4)
    })
  })
})