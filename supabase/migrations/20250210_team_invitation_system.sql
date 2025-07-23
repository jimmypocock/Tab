-- Team Invitation System
-- Adds support for secure team member invitations with tokens

-- Create invitation_tokens table
CREATE TABLE IF NOT EXISTS invitation_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES users(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES users(id),
  
  -- Metadata
  department TEXT,
  title TEXT,
  custom_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for lookups
CREATE INDEX idx_invitation_tokens_token ON invitation_tokens(token) WHERE accepted_at IS NULL;
CREATE INDEX idx_invitation_tokens_email ON invitation_tokens(email) WHERE accepted_at IS NULL;
CREATE INDEX idx_invitation_tokens_organization ON invitation_tokens(organization_id);
CREATE INDEX idx_invitation_tokens_expires ON invitation_tokens(expires_at) WHERE accepted_at IS NULL;

-- Enable RLS
ALTER TABLE invitation_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invitation_tokens
CREATE POLICY "Organization admins can view invitations"
  ON invitation_tokens
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = invitation_tokens.organization_id
        AND organization_users.user_id = (SELECT auth.uid())
        AND organization_users.role IN ('owner', 'admin')
        AND organization_users.status = 'active'
    )
  );

CREATE POLICY "Organization admins can create invitations"
  ON invitation_tokens
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = invitation_tokens.organization_id
        AND organization_users.user_id = (SELECT auth.uid())
        AND organization_users.role IN ('owner', 'admin')
        AND organization_users.status = 'active'
    )
    AND invited_by = (SELECT auth.uid())
  );

CREATE POLICY "Organization admins can delete invitations"
  ON invitation_tokens
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM organization_users
      WHERE organization_users.organization_id = invitation_tokens.organization_id
        AND organization_users.user_id = (SELECT auth.uid())
        AND organization_users.role IN ('owner', 'admin')
        AND organization_users.status = 'active'
    )
    AND accepted_at IS NULL -- Can only delete unaccepted invitations
  );

-- Add invitation tracking to organization_users
ALTER TABLE organization_users
  ADD COLUMN IF NOT EXISTS invitation_token_id UUID REFERENCES invitation_tokens(id),
  ADD COLUMN IF NOT EXISTS invitation_accepted_at TIMESTAMPTZ;

-- Create function to clean up expired invitations
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Delete expired, unaccepted invitations
  DELETE FROM public.invitation_tokens
  WHERE expires_at < NOW()
    AND accepted_at IS NULL;
    
  -- Also remove any pending organization_users records that were created
  -- for invitations that have now expired
  DELETE FROM public.organization_users
  WHERE status = 'pending_invitation'
    AND invitation_token_id IN (
      SELECT id FROM public.invitation_tokens
      WHERE expires_at < NOW()
        AND accepted_at IS NULL
    );
END;
$$;

-- Create function to accept invitation
CREATE OR REPLACE FUNCTION accept_invitation(
  p_token TEXT,
  p_user_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  organization_id UUID,
  role TEXT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invitation RECORD;
  v_existing_membership RECORD;
BEGIN
  -- Find the invitation
  SELECT * INTO v_invitation
  FROM public.invitation_tokens
  WHERE token = p_token
    AND accepted_at IS NULL
    AND expires_at > NOW();
    
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      FALSE::BOOLEAN,
      NULL::UUID,
      NULL::TEXT,
      'Invalid or expired invitation'::TEXT;
    RETURN;
  END IF;
  
  -- Check if user is already a member
  SELECT * INTO v_existing_membership
  FROM public.organization_users
  WHERE organization_id = v_invitation.organization_id
    AND user_id = p_user_id
    AND status = 'active';
    
  IF FOUND THEN
    RETURN QUERY SELECT 
      FALSE::BOOLEAN,
      v_invitation.organization_id,
      v_existing_membership.role,
      'User is already a member of this organization'::TEXT;
    RETURN;
  END IF;
  
  -- Mark invitation as accepted
  UPDATE public.invitation_tokens
  SET accepted_at = NOW(),
      accepted_by = p_user_id
  WHERE id = v_invitation.id;
  
  -- Add user to organization
  INSERT INTO public.organization_users (
    organization_id,
    user_id,
    role,
    department,
    title,
    invitation_token_id,
    invitation_accepted_at,
    invited_by,
    invited_at,
    status
  ) VALUES (
    v_invitation.organization_id,
    p_user_id,
    v_invitation.role,
    v_invitation.department,
    v_invitation.title,
    v_invitation.id,
    NOW(),
    v_invitation.invited_by,
    v_invitation.created_at,
    'active'
  )
  ON CONFLICT (organization_id, user_id) 
  DO UPDATE SET
    role = EXCLUDED.role,
    department = EXCLUDED.department,
    title = EXCLUDED.title,
    invitation_token_id = EXCLUDED.invitation_token_id,
    invitation_accepted_at = EXCLUDED.invitation_accepted_at,
    status = 'active',
    joined_at = NOW();
  
  RETURN QUERY SELECT 
    TRUE::BOOLEAN,
    v_invitation.organization_id,
    v_invitation.role,
    NULL::TEXT;
END;
$$;

-- Create view for pending invitations with user info
CREATE OR REPLACE VIEW pending_invitations AS
SELECT 
  it.id,
  it.organization_id,
  it.email,
  it.role,
  it.department,
  it.title,
  it.expires_at,
  it.created_at,
  ib.email AS invited_by_email,
  o.name AS organization_name,
  o.slug AS organization_slug,
  CASE 
    WHEN it.expires_at < NOW() THEN 'expired'
    ELSE 'pending'
  END AS status
FROM invitation_tokens it
JOIN users ib ON it.invited_by = ib.id
JOIN organizations o ON it.organization_id = o.id
WHERE it.accepted_at IS NULL;

-- Grant access to the view
GRANT SELECT ON pending_invitations TO authenticated;