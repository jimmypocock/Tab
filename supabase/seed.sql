-- Clean seed data for the new organization flow
-- Users are created without organizations

-- Create test users with passwords directly in auth.users
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  invited_at,
  confirmation_sent_at,
  recovery_token,
  recovery_sent_at,
  email_change_token_new,
  email_change,
  email_change_sent_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  phone,
  phone_confirmed_at,
  phone_change,
  phone_change_token,
  phone_change_sent_at
) VALUES 
-- User with organization
(
  '00000000-0000-0000-0000-000000000000',
  '550e8400-e29b-41d4-a716-446655440001',
  'authenticated',
  'authenticated',
  'owner@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  '',
  NULL,
  NULL,
  '',
  NULL,
  '',
  '',
  NULL,
  '{}',
  '{"first_name": "Business", "last_name": "Owner"}',
  NOW(),
  NOW(),
  NULL,
  NULL,
  '',
  '',
  NULL
),
-- User without organization (new signup)
(
  '00000000-0000-0000-0000-000000000000',
  '550e8400-e29b-41d4-a716-446655440002',
  'authenticated',
  'authenticated',
  'newuser@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  '',
  NULL,
  NULL,
  '',
  NULL,
  '',
  '',
  NULL,
  '{}',
  '{"first_name": "New", "last_name": "User"}',
  NOW(),
  NOW(),
  NULL,
  NULL,
  '',
  '',
  NULL
),
-- Another user without organization
(
  '00000000-0000-0000-0000-000000000000',
  '550e8400-e29b-41d4-a716-446655440003',
  'authenticated',
  'authenticated',
  'solo@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  '',
  NULL,
  NULL,
  '',
  NULL,
  '',
  '',
  NULL,
  '{}',
  '{"first_name": "Solo", "last_name": "User"}',
  NOW(),
  NOW(),
  NULL,
  NULL,
  '',
  '',
  NULL
)
ON CONFLICT (id) DO UPDATE SET
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = EXCLUDED.email_confirmed_at;

-- The handle_new_user trigger will create user records in public.users
-- But NOT create organizations anymore

-- Wait for triggers
SELECT pg_sleep(0.1);

-- Create one organization manually
INSERT INTO organizations (
  id,
  name,
  slug,
  type,
  is_merchant,
  is_corporate,
  primary_email,
  created_by,
  created_at,
  updated_at
) VALUES (
  '5c8a50c0-51f9-4242-a0ed-42b5a23818c8',
  'Acme Corporation',
  'acme-corporation',
  'business',
  true,
  false,
  'owner@example.com',
  '550e8400-e29b-41d4-a716-446655440001',
  NOW(),
  NOW()
);

-- Add the owner to the organization
INSERT INTO organization_users (
  organization_id,
  user_id,
  role,
  status,
  joined_at
) VALUES (
  '5c8a50c0-51f9-4242-a0ed-42b5a23818c8',
  '550e8400-e29b-41d4-a716-446655440001',
  'owner',
  'active',
  NOW()
);

-- Create an API key for the organization
INSERT INTO api_keys (
  id,
  organization_id,
  key_hash,
  key_prefix,
  last_four,
  name,
  scope,
  is_active,
  created_at,
  created_by
) VALUES (
  '660e8400-e29b-41d4-a716-446655440001',
  '5c8a50c0-51f9-4242-a0ed-42b5a23818c8',
  encode(sha256('tab_test_12345678901234567890123456789012'::bytea), 'hex'),
  'tab_test',
  '9012',
  'Development API Key',
  'full',
  true,
  NOW(),
  '550e8400-e29b-41d4-a716-446655440001'
);

-- Create a pending invitation for newuser@example.com
INSERT INTO invitations (
  organization_id,
  invited_by,
  email,
  role,
  token,
  status,
  expires_at,
  created_at
) VALUES (
  '5c8a50c0-51f9-4242-a0ed-42b5a23818c8',
  '550e8400-e29b-41d4-a716-446655440001',
  'newuser@example.com',
  'member',
  encode(gen_random_bytes(32), 'hex'),
  'pending',
  NOW() + INTERVAL '7 days',
  NOW()
);

-- Add helpful development note
DO $$
BEGIN
  RAISE NOTICE 'Clean seed data loaded!';
  RAISE NOTICE '';
  RAISE NOTICE 'Test Users (password: password123):';
  RAISE NOTICE '  - owner@example.com (has organization: Acme Corporation)';
  RAISE NOTICE '  - newuser@example.com (no org, has pending invitation)';
  RAISE NOTICE '  - solo@example.com (no org, no invitations)';
  RAISE NOTICE '';
  RAISE NOTICE 'Test API Key:';
  RAISE NOTICE '  - Acme Corporation: tab_test_12345678901234567890123456789012';
END $$;