-- Seed data for local development
-- This file contains test data to help with local development

-- Create test users
INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'test@example.com', '{"business_name": "Test Business Inc"}', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440002', 'demo@example.com', '{"business_name": "Demo Company LLC"}', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- The handle_new_user trigger will automatically create:
-- 1. Records in the users table
-- 2. Organizations for each user
-- 3. Organization_users relationships

-- Wait a bit for triggers to complete
SELECT pg_sleep(0.1);

-- Get the organization IDs that were created
DO $$
DECLARE
  test_org_id UUID;
  demo_org_id UUID;
BEGIN
  -- Get Test Business Inc organization
  SELECT id INTO test_org_id FROM organizations WHERE name = 'Test Business Inc' LIMIT 1;
  
  -- Get Demo Company LLC organization
  SELECT id INTO demo_org_id FROM organizations WHERE name = 'Demo Company LLC' LIMIT 1;

  -- Create test API keys if organizations exist
  IF test_org_id IS NOT NULL THEN
    -- Test API Key 1: tab_test_12345678901234567890123456789012
    INSERT INTO api_keys (id, organization_id, key_hash, key_prefix, name, scope, is_active, created_at)
    VALUES (
      '660e8400-e29b-41d4-a716-446655440001',
      test_org_id,
      encode(sha256('tab_test_12345678901234567890123456789012'::bytea), 'hex'),
      'tab_test',
      'Development API Key',
      'merchant',
      true,
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    -- Create sample tabs for test organization
    INSERT INTO tabs (id, organization_id, customer_email, customer_name, status, currency, subtotal, tax_amount, total_amount, paid_amount, created_at, updated_at)
    VALUES 
      (
        '770e8400-e29b-41d4-a716-446655440001',
        test_org_id,
        'customer1@example.com',
        'John Doe',
        'open',
        'USD',
        100.00,
        8.00,
        108.00,
        0.00,
        NOW() - INTERVAL '5 days',
        NOW() - INTERVAL '5 days'
      ),
      (
        '770e8400-e29b-41d4-a716-446655440002',
        test_org_id,
        'customer2@example.com',
        'Jane Smith',
        'paid',
        'USD',
        250.00,
        20.00,
        270.00,
        270.00,
        NOW() - INTERVAL '3 days',
        NOW() - INTERVAL '2 days'
      )
    ON CONFLICT (id) DO NOTHING;

    -- Create line items for first tab
    INSERT INTO line_items (tab_id, description, quantity, unit_price, total, created_at)
    VALUES 
      ('770e8400-e29b-41d4-a716-446655440001', 'Product A', 2, 30.00, 60.00, NOW() - INTERVAL '5 days'),
      ('770e8400-e29b-41d4-a716-446655440001', 'Product B', 1, 40.00, 40.00, NOW() - INTERVAL '5 days')
    ON CONFLICT DO NOTHING;
  END IF;

  IF demo_org_id IS NOT NULL THEN
    -- Demo API Key: tab_test_98765432109876543210987654321098
    INSERT INTO api_keys (id, organization_id, key_hash, key_prefix, name, scope, is_active, created_at)
    VALUES (
      '660e8400-e29b-41d4-a716-446655440002',
      demo_org_id,
      encode(sha256('tab_test_98765432109876543210987654321098'::bytea), 'hex'),
      'tab_test',
      'Demo API Key',
      'merchant',
      true,
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Create a corporate organization 
  -- Note: Skip created_by since it references users table which may not be populated yet
  INSERT INTO organizations (id, name, slug, type, is_merchant, is_corporate, primary_email, created_at, updated_at)
  VALUES (
    '880e8400-e29b-41d4-a716-446655440001',
    'Acme Corporation',
    'acme-corporation',
    'business',
    false,
    true,
    'corporate@acme.com',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- Skip manual organization_users insert - handle_new_user trigger already created the relationships

  -- Create relationship between Demo Company (merchant) and Acme Corporation (corporate)
  IF demo_org_id IS NOT NULL THEN
    INSERT INTO organization_relationships (
      merchant_org_id,
      corporate_org_id,
      credit_limit,
      payment_terms,
      status,
      approved_by,
      approved_at,
      created_at,
      updated_at
    )
    VALUES (
      demo_org_id,
      '880e8400-e29b-41d4-a716-446655440001',
      10000.00,
      'NET30',
      'active',
      '550e8400-e29b-41d4-a716-446655440002',
      NOW(),
      NOW(),
      NOW()
    )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Add helpful development note
DO $$
BEGIN
  RAISE NOTICE 'Seed data loaded successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Test API Keys:';
  RAISE NOTICE '  - Test Business Inc: tab_test_12345678901234567890123456789012';
  RAISE NOTICE '  - Demo Company LLC: tab_test_98765432109876543210987654321098';
  RAISE NOTICE '';
  RAISE NOTICE 'Test Users:';
  RAISE NOTICE '  - test@example.com (Test Business Inc - Merchant)';
  RAISE NOTICE '  - demo@example.com (Demo Company LLC - Merchant & Acme Corporation - Corporate)';
END $$;