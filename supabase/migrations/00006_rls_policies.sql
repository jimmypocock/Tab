-- Row Level Security Policies
-- Comprehensive RLS policies for all tables

-- ============================================
-- Users table policies
-- ============================================

-- Users can view their own profile
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Users can insert their own record (handled by trigger, but needed for RLS)
CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- ============================================
-- Organizations table policies
-- ============================================

-- Users can view organizations they belong to
CREATE POLICY "organizations_select_member" ON public.organizations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE organization_users.organization_id = organizations.id
        AND organization_users.user_id = auth.uid()
        AND organization_users.status = 'active'
    )
  );

-- Authenticated users can create organizations
CREATE POLICY "organizations_insert_authenticated" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
  );

-- Owners and admins can update their organizations
CREATE POLICY "organizations_update_admin" ON public.organizations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE organization_users.organization_id = organizations.id
        AND organization_users.user_id = auth.uid()
        AND organization_users.role IN ('owner', 'admin')
        AND organization_users.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE organization_users.organization_id = organizations.id
        AND organization_users.user_id = auth.uid()
        AND organization_users.role IN ('owner', 'admin')
        AND organization_users.status = 'active'
    )
  );

-- Only owners can delete organizations
CREATE POLICY "organizations_delete_owner" ON public.organizations
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_users
      WHERE organization_users.organization_id = organizations.id
        AND organization_users.user_id = auth.uid()
        AND organization_users.role = 'owner'
        AND organization_users.status = 'active'
    )
  );

-- ============================================
-- Organization users table policies
-- ============================================

-- Users can view members of their organizations
CREATE POLICY "organization_users_select_member" ON public.organization_users
  FOR SELECT TO authenticated
  USING (
    -- Check if the user is a member of this organization
    EXISTS (
      SELECT 1 FROM public.organization_users ou2
      WHERE ou2.organization_id = organization_users.organization_id
        AND ou2.user_id = auth.uid()
        AND ou2.status = 'active'
    )
  );

-- Users can add themselves as owner when creating an org, or admins can add members
CREATE POLICY "organization_users_insert" ON public.organization_users
  FOR INSERT TO authenticated
  WITH CHECK (
    -- User adding themselves as owner (during org creation)
    (user_id = auth.uid() AND role = 'owner')
    OR
    -- Admin adding someone else
    EXISTS (
      SELECT 1 FROM public.organization_users existing
      WHERE existing.organization_id = organization_users.organization_id
        AND existing.user_id = auth.uid()
        AND existing.role IN ('owner', 'admin')
        AND existing.status = 'active'
    )
  );

-- Admins can update organization members
CREATE POLICY "organization_users_update_admin" ON public.organization_users
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_users admin
      WHERE admin.organization_id = organization_users.organization_id
        AND admin.user_id = auth.uid()
        AND admin.role IN ('owner', 'admin')
        AND admin.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_users admin
      WHERE admin.organization_id = organization_users.organization_id
        AND admin.user_id = auth.uid()
        AND admin.role IN ('owner', 'admin')
        AND admin.status = 'active'
    )
  );

-- Admins can remove organization members
CREATE POLICY "organization_users_delete_admin" ON public.organization_users
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_users admin
      WHERE admin.organization_id = organization_users.organization_id
        AND admin.user_id = auth.uid()
        AND admin.role IN ('owner', 'admin')
        AND admin.status = 'active'
    )
  );

-- ============================================
-- Tabs table policies
-- ============================================

-- Members can view their organization's tabs
CREATE POLICY "tabs_select_member" ON public.tabs
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Members can create tabs for their organization
CREATE POLICY "tabs_insert_member" ON public.tabs
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('owner', 'admin', 'member')
    )
  );

-- Members can update their organization's tabs
CREATE POLICY "tabs_update_member" ON public.tabs
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('owner', 'admin', 'member')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('owner', 'admin', 'member')
    )
  );

-- Admins can delete tabs
CREATE POLICY "tabs_delete_admin" ON public.tabs
  FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );

-- ============================================
-- Line items table policies
-- ============================================

-- Inherit access from tabs
CREATE POLICY "line_items_select" ON public.line_items
  FOR SELECT TO authenticated
  USING (
    tab_id IN (
      SELECT id FROM public.tabs
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_users
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

CREATE POLICY "line_items_insert" ON public.line_items
  FOR INSERT TO authenticated
  WITH CHECK (
    tab_id IN (
      SELECT id FROM public.tabs
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_users
        WHERE user_id = auth.uid() 
          AND status = 'active'
          AND role IN ('owner', 'admin', 'member')
      )
    )
  );

CREATE POLICY "line_items_update" ON public.line_items
  FOR UPDATE TO authenticated
  USING (
    tab_id IN (
      SELECT id FROM public.tabs
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_users
        WHERE user_id = auth.uid() 
          AND status = 'active'
          AND role IN ('owner', 'admin', 'member')
      )
    )
  )
  WITH CHECK (
    tab_id IN (
      SELECT id FROM public.tabs
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_users
        WHERE user_id = auth.uid() 
          AND status = 'active'
          AND role IN ('owner', 'admin', 'member')
      )
    )
  );

CREATE POLICY "line_items_delete" ON public.line_items
  FOR DELETE TO authenticated
  USING (
    tab_id IN (
      SELECT id FROM public.tabs
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_users
        WHERE user_id = auth.uid() 
          AND status = 'active'
          AND role IN ('owner', 'admin', 'member')
      )
    )
  );

-- ============================================
-- Payments table policies
-- ============================================

-- Members can view their organization's payments
CREATE POLICY "payments_select_member" ON public.payments
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- System creates payments (via API/webhooks), no direct user creation
-- But members can update payment metadata
CREATE POLICY "payments_update_member" ON public.payments
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );

-- ============================================
-- API Keys table policies
-- ============================================

-- Only admins can view API keys
CREATE POLICY "api_keys_select_admin" ON public.api_keys
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );

-- Only admins can create API keys
CREATE POLICY "api_keys_insert_admin" ON public.api_keys
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );

-- Only admins can update API keys
CREATE POLICY "api_keys_update_admin" ON public.api_keys
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );

-- Only admins can delete API keys
CREATE POLICY "api_keys_delete_admin" ON public.api_keys
  FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );

-- ============================================
-- Invitations table policies
-- ============================================

-- Members can view invitations for their organization
CREATE POLICY "invitations_select_member" ON public.invitations
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR email = (SELECT email FROM public.users WHERE id = auth.uid())
  );

-- Handled by send_invitation function, but needed for RLS
CREATE POLICY "invitations_insert_admin" ON public.invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );

-- Admins can update invitations
CREATE POLICY "invitations_update_admin" ON public.invitations
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );

-- ============================================
-- Organization activity table policies
-- ============================================

-- Members can view activity for their organization
CREATE POLICY "organization_activity_select_member" ON public.organization_activity
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Activity is created by system/functions, no direct user access needed
-- But we need a policy for SECURITY DEFINER functions
CREATE POLICY "organization_activity_insert_system" ON public.organization_activity
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ============================================
-- Billing groups and related tables
-- ============================================

-- Similar pattern for billing groups
CREATE POLICY "billing_groups_select_member" ON public.billing_groups
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "billing_groups_insert_admin" ON public.billing_groups
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "billing_groups_update_admin" ON public.billing_groups
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "billing_groups_delete_admin" ON public.billing_groups
  FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );

-- Invoices policies
CREATE POLICY "invoices_select_member" ON public.invoices
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "invoices_insert_member" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "invoices_update_member" ON public.invoices
  FOR UPDATE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('owner', 'admin', 'member')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "invoices_delete_admin" ON public.invoices
  FOR DELETE TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() 
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );