-- Invitations and Activity Logging
-- Handles team invitations and organization activity tracking

-- Invitations table
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Invitation details
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'canceled')),
  
  -- Token for invitation link
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  
  -- Metadata
  invited_by UUID NOT NULL REFERENCES public.users(id),
  accepted_by UUID REFERENCES public.users(id),
  
  -- Timestamps
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  
  -- Optional message
  message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization activity log
CREATE TABLE IF NOT EXISTS public.organization_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Activity details
  actor_id UUID REFERENCES public.users(id),
  actor_email TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  
  -- Additional context
  changes JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  -- IP and user agent for security
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_invitations_organization_id ON public.invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON public.invitations(expires_at);
CREATE INDEX IF NOT EXISTS idx_org_activity_organization_id ON public.organization_activity(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_activity_actor_id ON public.organization_activity(actor_id);
CREATE INDEX IF NOT EXISTS idx_org_activity_created_at ON public.organization_activity(created_at);
CREATE INDEX IF NOT EXISTS idx_org_activity_action ON public.organization_activity(action);

-- Add trigger for invitations
CREATE TRIGGER update_invitations_updated_at BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_activity ENABLE ROW LEVEL SECURITY;

-- Create function to accept invitation
CREATE OR REPLACE FUNCTION public.accept_invitation(
  p_token TEXT,
  p_user_id UUID
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
  v_result json;
BEGIN
  -- Find the invitation
  SELECT * INTO v_invitation
  FROM invitations
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid or expired invitation'
    );
  END IF;

  -- Check if user is already a member
  IF EXISTS (
    SELECT 1 FROM organization_users
    WHERE organization_id = v_invitation.organization_id
      AND user_id = p_user_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User is already a member of this organization'
    );
  END IF;

  -- Start transaction
  BEGIN
    -- Update invitation
    UPDATE invitations
    SET status = 'accepted',
        accepted_by = p_user_id,
        accepted_at = NOW()
    WHERE id = v_invitation.id;

    -- Add user to organization
    INSERT INTO organization_users (
      organization_id,
      user_id,
      role,
      status,
      joined_at,
      invited_by
    ) VALUES (
      v_invitation.organization_id,
      p_user_id,
      v_invitation.role,
      'active',
      NOW(),
      v_invitation.invited_by
    );

    -- Log activity
    INSERT INTO organization_activity (
      organization_id,
      actor_id,
      action,
      resource_type,
      resource_id,
      metadata
    ) VALUES (
      v_invitation.organization_id,
      p_user_id,
      'invitation.accepted',
      'invitation',
      v_invitation.id,
      jsonb_build_object(
        'invited_by', v_invitation.invited_by,
        'role', v_invitation.role
      )
    );

    v_result := json_build_object(
      'success', true,
      'organization_id', v_invitation.organization_id
    );

    RETURN v_result;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN json_build_object(
        'success', false,
        'error', SQLERRM
      );
  END;
END;
$$;

-- Create function to send invitation
CREATE OR REPLACE FUNCTION public.send_invitation(
  p_organization_id UUID,
  p_email TEXT,
  p_role TEXT,
  p_invited_by UUID,
  p_message TEXT DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation_id UUID;
  v_token TEXT;
BEGIN
  -- Check if user can invite (must be owner or admin)
  IF NOT EXISTS (
    SELECT 1 FROM organization_users
    WHERE organization_id = p_organization_id
      AND user_id = p_invited_by
      AND role IN ('owner', 'admin')
      AND status = 'active'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Insufficient permissions to send invitations'
    );
  END IF;

  -- Check if email is already invited
  IF EXISTS (
    SELECT 1 FROM invitations
    WHERE organization_id = p_organization_id
      AND email = p_email
      AND status = 'pending'
      AND expires_at > NOW()
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'An active invitation already exists for this email'
    );
  END IF;

  -- Check if user is already a member
  IF EXISTS (
    SELECT 1 FROM organization_users ou
    JOIN users u ON u.id = ou.user_id
    WHERE ou.organization_id = p_organization_id
      AND u.email = p_email
      AND ou.status = 'active'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User is already a member of this organization'
    );
  END IF;

  -- Create invitation
  INSERT INTO invitations (
    organization_id,
    email,
    role,
    invited_by,
    message
  ) VALUES (
    p_organization_id,
    p_email,
    p_role,
    p_invited_by,
    p_message
  ) RETURNING id, token INTO v_invitation_id, v_token;

  -- Log activity
  INSERT INTO organization_activity (
    organization_id,
    actor_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    p_organization_id,
    p_invited_by,
    'invitation.sent',
    'invitation',
    v_invitation_id,
    jsonb_build_object(
      'email', p_email,
      'role', p_role
    )
  );

  RETURN json_build_object(
    'success', true,
    'invitation_id', v_invitation_id,
    'token', v_token
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_invitation(UUID, TEXT, TEXT, UUID, TEXT) TO authenticated;