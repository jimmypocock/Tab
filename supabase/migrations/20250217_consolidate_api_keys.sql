-- Consolidate API keys tables and remove deprecated fields

-- Add new columns to api_keys if they don't exist
ALTER TABLE public.api_keys 
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id),
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS scope text DEFAULT 'merchant',
ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '{}';

-- First, migrate any existing corporate_api_keys to the main api_keys table (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'corporate_api_keys') THEN
        INSERT INTO public.api_keys (
            id,
            organization_id,
            key_hash,
            key_prefix,
            name,
            scope,
            permissions,
            last_used_at,
            is_active,
            created_at,
            created_by
        )
        SELECT 
            cak.id,
            ca.id as organization_id, -- This will need to be mapped to an organization
            cak.key_hash,
            cak.key_prefix,
            cak.description as name,
            'corporate' as scope,
            '{"access": "full"}'::jsonb as permissions,
            cak.last_used_at,
            cak.is_active,
            cak.created_at,
            NULL as created_by -- We don't have this info in corporate_api_keys
        FROM public.corporate_api_keys cak
        LEFT JOIN public.corporate_accounts ca ON ca.id = cak.corporate_account_id
        WHERE NOT EXISTS (
            SELECT 1 FROM public.api_keys ak WHERE ak.id = cak.id
        );
    END IF;
END $$;

-- Add revoked_at column to api_keys if we want to preserve this functionality
ALTER TABLE public.api_keys 
ADD COLUMN IF NOT EXISTS revoked_at timestamp with time zone;

-- Update any corporate keys that were revoked
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'corporate_api_keys') THEN
        UPDATE public.api_keys ak
        SET revoked_at = cak.revoked_at
        FROM public.corporate_api_keys cak
        WHERE ak.id = cak.id AND cak.revoked_at IS NOT NULL;
    END IF;
END $$;

-- Drop the corporate_api_keys table if it exists
DROP TABLE IF EXISTS public.corporate_api_keys CASCADE;

-- Remove deprecated merchantId column from api_keys
ALTER TABLE public.api_keys 
DROP COLUMN IF EXISTS merchant_id CASCADE;

-- Make organization_id required going forward (only if there are no NULL values)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.api_keys WHERE organization_id IS NULL) THEN
        ALTER TABLE public.api_keys ALTER COLUMN organization_id SET NOT NULL;
    END IF;
END $$;

-- Add useful indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_organization ON public.api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON public.api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_scope ON public.api_keys(scope);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON public.api_keys(is_active);

-- Update RLS policies for api_keys to work with organizations
DROP POLICY IF EXISTS "Users can view their merchant's API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can create API keys for their merchant" ON public.api_keys;
DROP POLICY IF EXISTS "Users can update their merchant's API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can delete their merchant's API keys" ON public.api_keys;

-- Create new RLS policies based on organizations
CREATE POLICY "Users can view their organization's API keys" ON public.api_keys
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM public.organization_users 
            WHERE user_id = auth.uid()
            AND status = 'active'
        )
    );

CREATE POLICY "Admins can create API keys for their organization" ON public.api_keys
    FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id 
            FROM public.organization_users 
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
            AND status = 'active'
        )
    );

CREATE POLICY "Admins can update their organization's API keys" ON public.api_keys
    FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM public.organization_users 
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
            AND status = 'active'
        )
    );

CREATE POLICY "Admins can delete their organization's API keys" ON public.api_keys
    FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM public.organization_users 
            WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
            AND status = 'active'
        )
    );

-- Clean up other deprecated tables and columns

-- Remove deprecated merchant_users table (replaced by organization_users)
DROP TABLE IF EXISTS public.merchant_users CASCADE;

-- Remove deprecated merchants table (replaced by organizations)
DROP TABLE IF EXISTS public.merchants CASCADE;

-- Remove deprecated corporate tables
DROP TABLE IF EXISTS public.corporate_account_activity CASCADE;
DROP TABLE IF EXISTS public.corporate_account_users CASCADE;
DROP TABLE IF EXISTS public.corporate_merchant_relationships CASCADE;
DROP TABLE IF EXISTS public.corporate_accounts CASCADE;

-- Remove deprecated columns from tabs table if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tabs' AND column_name = 'merchant_id') THEN
        ALTER TABLE public.tabs DROP COLUMN merchant_id CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tabs' AND column_name = 'corporate_account_id') THEN
        ALTER TABLE public.tabs DROP COLUMN corporate_account_id CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tabs' AND column_name = 'corporate_relationship_id') THEN
        ALTER TABLE public.tabs DROP COLUMN corporate_relationship_id CASCADE;
    END IF;
END $$;

-- Remove deprecated columns from other tables if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'merchant_processors' AND column_name = 'merchant_id') THEN
        ALTER TABLE public.merchant_processors DROP COLUMN merchant_id CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'merchant_id') THEN
        ALTER TABLE public.invoices DROP COLUMN merchant_id CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_milestones' AND column_name = 'merchant_id') THEN
        ALTER TABLE public.project_milestones DROP COLUMN merchant_id CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'retainer_accounts' AND column_name = 'merchant_id') THEN
        ALTER TABLE public.retainer_accounts DROP COLUMN merchant_id CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'retainer_accounts' AND column_name = 'customer_id') THEN
        ALTER TABLE public.retainer_accounts DROP COLUMN customer_id CASCADE;
    END IF;
END $$;

-- Update any NULL organization_id in tabs to use a default organization if needed
-- First check if there are any NULL values
DO $$
BEGIN
    -- Only make organization_id NOT NULL if there are no NULL values
    IF NOT EXISTS (SELECT 1 FROM public.tabs WHERE organization_id IS NULL) THEN
        ALTER TABLE public.tabs ALTER COLUMN organization_id SET NOT NULL;
    END IF;
END $$;

-- Add helpful comment
COMMENT ON TABLE public.api_keys IS 'Unified API keys for all organization types (merchant, corporate, platform)';
COMMENT ON COLUMN public.api_keys.scope IS 'Access scope: merchant (merchant operations), corporate (corporate purchasing), full (all access)';
COMMENT ON COLUMN public.api_keys.revoked_at IS 'Timestamp when the key was revoked. NULL means active (also check is_active flag)';