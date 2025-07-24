-- Add activity logging for organizations (replaces corporate_account_activity)

-- Create activity log table
CREATE TABLE IF NOT EXISTS public.organization_activity (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    action text NOT NULL,
    entity_type text, -- 'tab', 'payment', 'user', 'api_key', etc.
    entity_id uuid,
    metadata jsonb DEFAULT '{}',
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_org_activity_organization ON public.organization_activity(organization_id);
CREATE INDEX idx_org_activity_created ON public.organization_activity(created_at DESC);
CREATE INDEX idx_org_activity_user ON public.organization_activity(user_id);
CREATE INDEX idx_org_activity_entity ON public.organization_activity(entity_type, entity_id);

-- RLS policies
ALTER TABLE public.organization_activity ENABLE ROW LEVEL SECURITY;

-- Users can view activity for their organizations
CREATE POLICY "Users can view their organization's activity" ON public.organization_activity
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM public.organization_users 
            WHERE user_id = auth.uid()
            AND status = 'active'
        )
    );

-- System can insert activity (via service role)
CREATE POLICY "System can insert activity" ON public.organization_activity
    FOR INSERT
    WITH CHECK (true); -- Controlled at API level

-- Add features column to organizations for feature flags
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS features jsonb DEFAULT '{}';

-- Add some default features to existing orgs based on their type
UPDATE public.organizations
SET features = 
    CASE 
        WHEN is_corporate = true THEN 
            jsonb_build_object(
                'cross_merchant_purchasing', true,
                'spending_analytics', true,
                'max_users', 50,
                'api_rate_limit', 5000
            )
        WHEN is_merchant = true THEN
            jsonb_build_object(
                'accept_payments', true,
                'issue_invoices', true,
                'max_users', 10,
                'api_rate_limit', 1000
            )
        ELSE '{}'::jsonb
    END
WHERE features = '{}'::jsonb;

-- Helper function to log activity
CREATE OR REPLACE FUNCTION public.log_organization_activity(
    p_organization_id uuid,
    p_user_id uuid,
    p_action text,
    p_entity_type text DEFAULT NULL,
    p_entity_id uuid DEFAULT NULL,
    p_metadata jsonb DEFAULT '{}',
    p_ip_address inet DEFAULT NULL,
    p_user_agent text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
    activity_id uuid;
BEGIN
    INSERT INTO public.organization_activity (
        organization_id,
        user_id,
        action,
        entity_type,
        entity_id,
        metadata,
        ip_address,
        user_agent
    ) VALUES (
        p_organization_id,
        p_user_id,
        p_action,
        p_entity_type,
        p_entity_id,
        p_metadata,
        p_ip_address,
        p_user_agent
    ) RETURNING id INTO activity_id;
    
    RETURN activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Example: Log when API keys are created
CREATE OR REPLACE FUNCTION public.log_api_key_creation()
RETURNS trigger AS $$
BEGIN
    PERFORM public.log_organization_activity(
        NEW.organization_id,
        NEW.created_by,
        'api_key_created',
        'api_key',
        NEW.id,
        jsonb_build_object(
            'key_prefix', NEW.key_prefix,
            'scope', NEW.scope
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_api_key_creation_trigger
    AFTER INSERT ON public.api_keys
    FOR EACH ROW
    EXECUTE FUNCTION public.log_api_key_creation();

-- Comment on the features column
COMMENT ON COLUMN public.organizations.features IS 'Feature flags for monetization and access control. Examples: cross_merchant_purchasing, spending_analytics, approval_workflows, max_users, api_rate_limit';