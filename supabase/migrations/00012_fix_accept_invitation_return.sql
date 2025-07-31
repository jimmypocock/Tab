-- Fix the accept_invitation function to return the role as well
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
      'error_message', 'Invalid or expired invitation',
      'organization_id', NULL::UUID,
      'role', NULL::TEXT
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
      'error_message', 'User is already a member of this organization',
      'organization_id', NULL::UUID,
      'role', NULL::TEXT
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

    -- Return success with organization_id and role
    RETURN json_build_object(
      'success', true,
      'organization_id', v_invitation.organization_id,
      'role', v_invitation.role,
      'error_message', NULL::TEXT
    );

  EXCEPTION
    WHEN OTHERS THEN
      RETURN json_build_object(
        'success', false,
        'error_message', SQLERRM,
        'organization_id', NULL::UUID,
        'role', NULL::TEXT
      );
  END;
END;
$$;

-- Log the fix
DO $$
BEGIN
  RAISE NOTICE 'Fixed accept_invitation function to return role in response';
END $$;