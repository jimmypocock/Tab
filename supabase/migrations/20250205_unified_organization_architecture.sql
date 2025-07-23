-- Unified Organization Architecture
-- Replaces separate merchants and corporate_accounts with unified organizations

-- 1. Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL DEFAULT 'business' CHECK (type IN ('business', 'individual', 'platform')),
  
  -- Capabilities (what this org can do)
  is_merchant BOOLEAN DEFAULT false,      -- Can create tabs/receive payments
  is_corporate BOOLEAN DEFAULT false,     -- Can have credit accounts with merchants
  
  -- Organization details
  legal_name TEXT,
  tax_id TEXT,
  website TEXT,
  logo_url TEXT,
  
  -- Contact info
  primary_email TEXT,
  billing_email TEXT,
  support_email TEXT,
  
  -- Address
  address JSONB DEFAULT '{}',
  
  -- Settings and metadata
  settings JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id)
);

-- 2. Create organization_users table (replaces merchant_users)
CREATE TABLE IF NOT EXISTS public.organization_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  
  -- Context-specific permissions
  merchant_permissions JSONB DEFAULT '{}',    -- Only used if org is_merchant
  corporate_permissions JSONB DEFAULT '{}',   -- Only used if org is_corporate
  
  -- Relationship metadata
  department TEXT,
  title TEXT,
  invited_by UUID REFERENCES public.users(id),
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending_invitation')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- 3. Create organization_relationships for B2B credit accounts
CREATE TABLE IF NOT EXISTS public.organization_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- The merchant organization providing credit
  merchant_org_id UUID NOT NULL REFERENCES public.organizations(id),
  
  -- The corporate organization receiving credit  
  corporate_org_id UUID NOT NULL REFERENCES public.organizations(id),
  
  -- Relationship details
  credit_limit DECIMAL(12, 2),
  current_balance DECIMAL(12, 2) DEFAULT 0,
  payment_terms TEXT DEFAULT 'NET30',
  discount_percentage DECIMAL(5, 2) DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMPTZ,
  
  -- Auto-pay settings
  auto_pay_enabled BOOLEAN DEFAULT false,
  auto_pay_method_id UUID,
  
  -- Custom terms
  custom_terms JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(merchant_org_id, corporate_org_id)
);

-- 4. Create indexes for performance
CREATE INDEX idx_organizations_slug ON public.organizations(slug);
CREATE INDEX idx_organizations_is_merchant ON public.organizations(is_merchant) WHERE is_merchant = true;
CREATE INDEX idx_organizations_is_corporate ON public.organizations(is_corporate) WHERE is_corporate = true;
CREATE INDEX idx_organizations_type ON public.organizations(type);
CREATE INDEX idx_organization_users_org_id ON public.organization_users(organization_id);
CREATE INDEX idx_organization_users_user_id ON public.organization_users(user_id);
CREATE INDEX idx_organization_users_role ON public.organization_users(role);
CREATE INDEX idx_organization_relationships_merchant ON public.organization_relationships(merchant_org_id);
CREATE INDEX idx_organization_relationships_corporate ON public.organization_relationships(corporate_org_id);
CREATE INDEX idx_organization_relationships_status ON public.organization_relationships(status);

-- 5. Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_relationships ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for organizations
CREATE POLICY "Users can view organizations they belong to" ON public.organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM public.organization_users 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Users can create organizations" ON public.organizations
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Organization owners and admins can update" ON public.organizations
  FOR UPDATE USING (
    id IN (
      SELECT organization_id FROM public.organization_users 
      WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin') 
        AND status = 'active'
    )
  );

-- 7. Create RLS policies for organization_users
CREATE POLICY "Users can view their organization relationships" ON public.organization_users
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can view organization members if they belong" ON public.organization_users
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Organization owners and admins can manage members" ON public.organization_users
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin') 
        AND status = 'active'
    )
  );

-- 8. Create RLS policies for organization_relationships
CREATE POLICY "View relationships for user's organizations" ON public.organization_relationships
  FOR SELECT USING (
    merchant_org_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR
    corporate_org_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Merchant admins can manage relationships" ON public.organization_relationships
  FOR ALL USING (
    merchant_org_id IN (
      SELECT organization_id FROM public.organization_users
      WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );

-- 9. Migrate existing merchants to organizations
INSERT INTO public.organizations (
  id,
  name,
  slug,
  type,
  is_merchant,
  is_corporate,
  primary_email,
  settings,
  created_at,
  updated_at,
  created_by
)
SELECT 
  m.id,
  m.business_name as name,
  COALESCE(m.slug, lower(regexp_replace(m.business_name, '[^a-zA-Z0-9]+', '-', 'g'))),
  'business' as type,
  true as is_merchant,
  false as is_corporate,
  m.email as primary_email,
  COALESCE(m.settings, '{}'::jsonb),
  m.created_at,
  m.updated_at,
  m.created_by
FROM public.merchants m
ON CONFLICT (id) DO NOTHING;

-- 10. Migrate existing corporate accounts to organizations
INSERT INTO public.organizations (
  id,
  name,
  slug,
  type,
  is_merchant,
  is_corporate,
  legal_name,
  tax_id,
  primary_email,
  address,
  metadata,
  created_at,
  updated_at
)
SELECT 
  ca.id,
  ca.company_name as name,
  lower(regexp_replace(ca.company_name, '[^a-zA-Z0-9]+', '-', 'g')) as slug,
  'business' as type,
  false as is_merchant,
  true as is_corporate,
  ca.company_name as legal_name, -- Use company_name as legal_name
  ca.tax_id,
  ca.primary_contact_email as primary_email,
  COALESCE(ca.billing_address, '{}'::jsonb) as address,
  ca.metadata,
  ca.created_at,
  ca.updated_at
FROM public.corporate_accounts ca
ON CONFLICT (id) DO UPDATE SET
  -- If organization already exists (was also a merchant), add corporate capability
  is_corporate = true,
  legal_name = EXCLUDED.legal_name,
  tax_id = EXCLUDED.tax_id,
  website = EXCLUDED.website,
  billing_email = EXCLUDED.billing_email,
  address = EXCLUDED.address;

-- 11. Migrate merchant_users to organization_users
INSERT INTO public.organization_users (
  id,
  organization_id,
  user_id,
  role,
  invited_by,
  invited_at,
  joined_at,
  status,
  created_at,
  updated_at
)
SELECT 
  mu.id,
  mu.merchant_id as organization_id,
  mu.user_id,
  mu.role,
  mu.invited_by,
  mu.invited_at,
  mu.joined_at,
  mu.status,
  mu.created_at,
  mu.updated_at
FROM public.merchant_users mu
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- 12. Migrate corporate account users to organization_users
INSERT INTO public.organization_users (
  organization_id,
  user_id,
  role,
  joined_at,
  status,
  created_at
)
SELECT 
  cau.corporate_account_id as organization_id,
  u.id as user_id,
  CASE 
    WHEN cau.role = 'admin' THEN 'admin'
    WHEN cau.role = 'approver' THEN 'admin'
    WHEN cau.role = 'purchaser' THEN 'member'
    ELSE 'viewer'
  END as role,
  cau.created_at as joined_at,
  CASE WHEN cau.is_active THEN 'active' ELSE 'suspended' END as status,
  cau.created_at
FROM public.corporate_account_users cau
JOIN public.users u ON u.email = cau.email
ON CONFLICT (organization_id, user_id) DO UPDATE SET
  -- If user already has access (e.g., was merchant user), update to higher role
  role = CASE 
    WHEN organization_users.role = 'owner' THEN 'owner'
    WHEN EXCLUDED.role = 'admin' OR organization_users.role = 'admin' THEN 'admin'
    ELSE organization_users.role
  END,
  department = COALESCE(organization_users.department, EXCLUDED.department),
  title = COALESCE(organization_users.title, EXCLUDED.title);

-- 13. Migrate corporate merchant relationships to organization_relationships
INSERT INTO public.organization_relationships (
  id,
  merchant_org_id,
  corporate_org_id,
  credit_limit,
  current_balance,
  payment_terms,
  discount_percentage,
  status,
  approved_by,
  approved_at,
  created_at,
  updated_at
)
SELECT 
  cmr.id,
  cmr.merchant_id as merchant_org_id,
  cmr.corporate_account_id as corporate_org_id,
  cmr.credit_limit,
  0 as current_balance, -- Default to 0 since field doesn't exist
  cmr.payment_terms,
  cmr.discount_percentage,
  cmr.status,
  cmr.approved_by,
  cmr.approved_at,
  cmr.created_at,
  cmr.updated_at
FROM public.corporate_merchant_relationships cmr;

-- 14. Add foreign key to tabs for organization
ALTER TABLE public.tabs 
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS paid_by_org_id UUID REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS relationship_id UUID REFERENCES public.organization_relationships(id);

-- Migrate merchant_id to organization_id
UPDATE public.tabs 
SET organization_id = merchant_id 
WHERE organization_id IS NULL AND merchant_id IS NOT NULL;

-- Migrate corporate relationships
UPDATE public.tabs t
SET 
  paid_by_org_id = t.corporate_account_id,
  relationship_id = t.corporate_relationship_id
WHERE t.corporate_account_id IS NOT NULL;

-- 15. Update api_keys table
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'merchant',
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';

-- Migrate merchant API keys
UPDATE public.api_keys
SET organization_id = merchant_id
WHERE organization_id IS NULL AND merchant_id IS NOT NULL;

-- Migrate corporate API keys
INSERT INTO public.api_keys (
  id,
  organization_id,
  key_hash,
  key_prefix,
  name,
  scope,
  last_used_at,
  is_active,
  created_at
)
SELECT 
  cak.id,
  cak.corporate_account_id as organization_id,
  cak.key_hash,
  cak.key_prefix,
  cak.description as name,
  'corporate' as scope,
  cak.last_used_at,
  cak.is_active,
  cak.created_at
FROM public.corporate_api_keys cak;

-- 16. Update merchant_processors table
ALTER TABLE public.merchant_processors
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

UPDATE public.merchant_processors
SET organization_id = merchant_id
WHERE organization_id IS NULL;

-- 17. Update invoices table
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

UPDATE public.invoices
SET organization_id = merchant_id
WHERE organization_id IS NULL;

-- 18. Create helper functions
CREATE OR REPLACE FUNCTION public.user_has_organization_access(
  p_user_id UUID,
  p_organization_id UUID,
  p_required_role TEXT DEFAULT 'member',
  p_context TEXT DEFAULT NULL -- 'merchant', 'corporate', or NULL for any
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_role TEXT;
  v_org_capabilities RECORD;
BEGIN
  -- Get organization capabilities
  SELECT is_merchant, is_corporate INTO v_org_capabilities
  FROM public.organizations
  WHERE id = p_organization_id;

  -- Check context matches organization capabilities
  IF p_context = 'merchant' AND NOT v_org_capabilities.is_merchant THEN
    RETURN FALSE;
  END IF;
  
  IF p_context = 'corporate' AND NOT v_org_capabilities.is_corporate THEN
    RETURN FALSE;
  END IF;

  -- Get user's role
  SELECT role INTO v_user_role
  FROM public.organization_users
  WHERE user_id = p_user_id 
    AND organization_id = p_organization_id 
    AND status = 'active';

  IF v_user_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check role hierarchy
  RETURN CASE
    WHEN p_required_role = 'viewer' THEN v_user_role IN ('viewer', 'member', 'admin', 'owner')
    WHEN p_required_role = 'member' THEN v_user_role IN ('member', 'admin', 'owner')
    WHEN p_required_role = 'admin' THEN v_user_role IN ('admin', 'owner')
    WHEN p_required_role = 'owner' THEN v_user_role = 'owner'
    ELSE FALSE
  END;
END;
$$ LANGUAGE plpgsql;

-- 19. Update triggers
CREATE TRIGGER update_organizations_updated_at 
  BEFORE UPDATE ON public.organizations 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organization_users_updated_at 
  BEFORE UPDATE ON public.organization_users 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organization_relationships_updated_at 
  BEFORE UPDATE ON public.organization_relationships 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 20. Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.organization_relationships TO authenticated;

-- Comments
COMMENT ON TABLE public.organizations IS 'Unified table for all business entities (replaces merchants and corporate_accounts)';
COMMENT ON COLUMN public.organizations.is_merchant IS 'Can create tabs and receive payments';
COMMENT ON COLUMN public.organizations.is_corporate IS 'Can have credit accounts with other organizations';
COMMENT ON TABLE public.organization_relationships IS 'B2B credit relationships between organizations';

-- Note: Old tables (merchants, corporate_accounts, etc.) are NOT dropped yet
-- They will be dropped in a future migration after verifying all data is migrated correctly