-- Organizations and Multi-tenancy Setup
-- Creates the organization structure with proper multi-tenant isolation

-- Organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL DEFAULT 'business' CHECK (type IN ('business', 'individual', 'platform')),
  
  -- Capabilities
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

-- Organization users (team members)
CREATE TABLE IF NOT EXISTS public.organization_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'invited')),
  
  -- Permissions
  merchant_permissions JSONB DEFAULT '{}',    -- Only used if org is_merchant
  corporate_permissions JSONB DEFAULT '{}',   -- Only used if org is_corporate
  
  -- Metadata
  joined_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ,
  invited_by UUID REFERENCES public.users(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organization_id, user_id)
);

-- Organization relationships (for merchant-corporate connections)
CREATE TABLE IF NOT EXISTS public.organization_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  corporate_org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Relationship details
  relationship_type TEXT NOT NULL DEFAULT 'credit_account',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended', 'terminated')),
  
  -- Credit account settings
  credit_limit DECIMAL(10,2),
  current_balance DECIMAL(10,2) DEFAULT 0,
  payment_terms_days INTEGER DEFAULT 30,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id),
  
  UNIQUE(merchant_org_id, corporate_org_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON public.organizations(created_by);
CREATE INDEX IF NOT EXISTS idx_organization_users_org_id ON public.organization_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_users_user_id ON public.organization_users(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_users_status ON public.organization_users(status);
CREATE INDEX IF NOT EXISTS idx_org_relationships_merchant ON public.organization_relationships(merchant_org_id);
CREATE INDEX IF NOT EXISTS idx_org_relationships_corporate ON public.organization_relationships(corporate_org_id);

-- Add triggers
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_users_updated_at BEFORE UPDATE ON public.organization_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_relationships_updated_at BEFORE UPDATE ON public.organization_relationships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_relationships ENABLE ROW LEVEL SECURITY;

-- Add helper function to check if user has organizations
CREATE OR REPLACE FUNCTION public.user_has_organizations(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_users
    WHERE user_id = p_user_id
      AND status = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_has_organizations(UUID) TO authenticated;