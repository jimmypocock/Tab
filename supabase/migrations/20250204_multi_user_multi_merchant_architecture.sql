-- Multi-User Multi-Merchant Architecture Implementation
-- Allows multiple users per merchant and multiple merchants per user

-- 1. Create users table (separate from auth.users for app data)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'UTC',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create merchant_users junction table for many-to-many relationships
CREATE TABLE IF NOT EXISTS public.merchant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  permissions JSONB DEFAULT '{}',
  invited_by UUID REFERENCES public.users(id),
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending_invitation')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(merchant_id, user_id)
);

-- 3. Create user_sessions table for merchant context tracking
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  current_merchant_id UUID REFERENCES public.merchants(id),
  session_data JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Update merchants table structure
ALTER TABLE public.merchants 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id),
ADD COLUMN IF NOT EXISTS slug TEXT,
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- Create unique index on merchant slug (for friendly URLs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_merchants_slug_unique ON public.merchants(slug) WHERE slug IS NOT NULL;

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_merchant_users_merchant_id ON public.merchant_users(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_users_user_id ON public.merchant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_merchant_users_role ON public.merchant_users(role);
CREATE INDEX IF NOT EXISTS idx_merchant_users_status ON public.merchant_users(status);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_merchant_id ON public.user_sessions(current_merchant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- 6. Enable RLS on new tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies for users table
CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- 8. Create RLS policies for merchant_users table
CREATE POLICY "Users can view their merchant relationships" ON public.merchant_users
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Merchant owners and admins can view team members" ON public.merchant_users
  FOR SELECT USING (
    merchant_id IN (
      SELECT merchant_id FROM public.merchant_users 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Merchant owners and admins can manage team members" ON public.merchant_users
  FOR ALL USING (
    merchant_id IN (
      SELECT merchant_id FROM public.merchant_users 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- 9. Create RLS policies for user_sessions table  
CREATE POLICY "Users can manage their own sessions" ON public.user_sessions
  FOR ALL USING (auth.uid() = user_id);

-- 10. Update merchants table RLS policies
DROP POLICY IF EXISTS "merchants_policy" ON public.merchants;
CREATE POLICY "Users can view merchants they belong to" ON public.merchants
  FOR SELECT USING (
    id IN (
      SELECT merchant_id FROM public.merchant_users 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Owners and admins can update merchant settings" ON public.merchants
  FOR UPDATE USING (
    id IN (
      SELECT merchant_id FROM public.merchant_users 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
    )
  );

CREATE POLICY "Users can create new merchants" ON public.merchants
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- 11. Create trigger functions for updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 12. Create triggers for updated_at timestamps
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON public.users 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_merchant_users_updated_at 
  BEFORE UPDATE ON public.merchant_users 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_sessions_updated_at 
  BEFORE UPDATE ON public.user_sessions 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 13. Update handle_new_user function to only create users record
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 14. Create function to add user to merchant with role
CREATE OR REPLACE FUNCTION public.add_user_to_merchant(
  p_merchant_id UUID,
  p_user_id UUID,
  p_role TEXT DEFAULT 'member',
  p_invited_by UUID DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_relationship_id UUID;
BEGIN
  -- Validate role
  IF p_role NOT IN ('owner', 'admin', 'member', 'viewer') THEN
    RAISE EXCEPTION 'Invalid role: %', p_role;
  END IF;

  -- Insert the relationship
  INSERT INTO public.merchant_users (
    merchant_id, 
    user_id, 
    role, 
    invited_by,
    status
  ) VALUES (
    p_merchant_id,
    p_user_id,
    p_role,
    p_invited_by,
    'active'
  )
  ON CONFLICT (merchant_id, user_id) 
  DO UPDATE SET 
    role = EXCLUDED.role,
    status = 'active',
    joined_at = NOW(),
    updated_at = NOW()
  RETURNING id INTO v_relationship_id;

  RETURN v_relationship_id;
END;
$$ LANGUAGE plpgsql;

-- 15. Create function to create merchant with owner
CREATE OR REPLACE FUNCTION public.create_merchant_with_owner(
  p_business_name TEXT,
  p_user_id UUID,
  p_slug TEXT DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_merchant_id UUID;
BEGIN
  -- Generate slug if not provided
  IF p_slug IS NULL THEN
    p_slug := lower(regexp_replace(p_business_name, '[^a-zA-Z0-9]+', '-', 'g'));
    p_slug := trim(both '-' from p_slug);
  END IF;

  -- Create the merchant
  INSERT INTO public.merchants (business_name, created_by, slug)
  VALUES (p_business_name, p_user_id, p_slug)
  RETURNING id INTO v_merchant_id;

  -- Add the creator as owner
  PERFORM public.add_user_to_merchant(v_merchant_id, p_user_id, 'owner');

  RETURN v_merchant_id;
END;
$$ LANGUAGE plpgsql;

-- 16. Create function to get user's merchants with roles
CREATE OR REPLACE FUNCTION public.get_user_merchants(p_user_id UUID)
RETURNS TABLE (
  merchant_id UUID,
  business_name TEXT,
  slug TEXT,
  role TEXT,
  joined_at TIMESTAMPTZ,
  merchant_created_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id as merchant_id,
    m.business_name,
    m.slug,
    mu.role,
    mu.joined_at,
    m.created_at as merchant_created_at
  FROM public.merchants m
  JOIN public.merchant_users mu ON m.id = mu.merchant_id
  WHERE mu.user_id = p_user_id 
    AND mu.status = 'active'
  ORDER BY mu.joined_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 17. Create function to check user merchant access
CREATE OR REPLACE FUNCTION public.user_has_merchant_access(
  p_user_id UUID,
  p_merchant_id UUID,
  p_required_role TEXT DEFAULT 'member'
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_role TEXT;
  v_role_hierarchy INTEGER;
  v_required_hierarchy INTEGER;
BEGIN
  -- Get user's role for this merchant
  SELECT role INTO v_user_role
  FROM public.merchant_users
  WHERE user_id = p_user_id 
    AND merchant_id = p_merchant_id 
    AND status = 'active';

  IF v_user_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Role hierarchy (higher number = more permissions)
  v_role_hierarchy := CASE v_user_role
    WHEN 'viewer' THEN 1
    WHEN 'member' THEN 2
    WHEN 'admin' THEN 3
    WHEN 'owner' THEN 4
    ELSE 0
  END;

  v_required_hierarchy := CASE p_required_role
    WHEN 'viewer' THEN 1
    WHEN 'member' THEN 2
    WHEN 'admin' THEN 3
    WHEN 'owner' THEN 4
    ELSE 0
  END;

  RETURN v_role_hierarchy >= v_required_hierarchy;
END;
$$ LANGUAGE plpgsql;

-- 18. Migration of existing data
-- Migrate existing merchants to new structure
DO $$
DECLARE
  merchant_record RECORD;
  auth_user_id UUID;
BEGIN
  -- For each existing merchant, create corresponding user and relationship
  FOR merchant_record IN 
    SELECT id, email, business_name, created_at 
    FROM public.merchants 
    WHERE email IS NOT NULL
  LOOP
    -- Find the corresponding auth user
    SELECT id INTO auth_user_id 
    FROM auth.users 
    WHERE email = merchant_record.email;

    IF auth_user_id IS NOT NULL THEN
      -- Create user record if it doesn't exist
      INSERT INTO public.users (id, email, created_at, updated_at)
      VALUES (auth_user_id, merchant_record.email, merchant_record.created_at, merchant_record.created_at)
      ON CONFLICT (id) DO NOTHING;

      -- Update merchant with created_by
      UPDATE public.merchants 
      SET created_by = auth_user_id,
          slug = lower(regexp_replace(business_name, '[^a-zA-Z0-9]+', '-', 'g'))
      WHERE id = merchant_record.id;

      -- Create owner relationship
      INSERT INTO public.merchant_users (merchant_id, user_id, role, joined_at, created_at)
      VALUES (merchant_record.id, auth_user_id, 'owner', merchant_record.created_at, merchant_record.created_at)
      ON CONFLICT (merchant_id, user_id) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- 19. Clean up merchant slugs (ensure uniqueness)
DO $$
DECLARE
  merchant_record RECORD;
  new_slug TEXT;
  counter INTEGER;
BEGIN
  FOR merchant_record IN 
    SELECT id, business_name, slug
    FROM public.merchants 
    WHERE slug IS NULL OR slug = ''
  LOOP
    new_slug := lower(regexp_replace(merchant_record.business_name, '[^a-zA-Z0-9]+', '-', 'g'));
    new_slug := trim(both '-' from new_slug);
    counter := 0;
    
    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM public.merchants WHERE slug = new_slug AND id != merchant_record.id) LOOP
      counter := counter + 1;
      new_slug := new_slug || '-' || counter::TEXT;
    END LOOP;
    
    UPDATE public.merchants SET slug = new_slug WHERE id = merchant_record.id;
  END LOOP;
END;
$$;

-- 20. Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_sessions TO authenticated;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

COMMENT ON TABLE public.users IS 'Application users (linked to auth.users)';
COMMENT ON TABLE public.merchant_users IS 'Many-to-many relationship between users and merchants with roles';
COMMENT ON TABLE public.user_sessions IS 'User session data including current merchant context';
COMMENT ON COLUMN public.merchant_users.role IS 'User role: owner (full access), admin (full except delete), member (create/edit), viewer (read-only)';
COMMENT ON COLUMN public.merchants.slug IS 'URL-friendly identifier for merchants';