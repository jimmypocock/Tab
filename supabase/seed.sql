-- Seed data for local development
-- This file contains test data to help with local development

-- Create test merchants
INSERT INTO merchants (id, email, business_name, created_at, updated_at)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'test@example.com', 'Test Business Inc', NOW(), NOW()),
  ('550e8400-e29b-41d4-a716-446655440002', 'demo@example.com', 'Demo Company LLC', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Create test API keys (using SHA256 hash)
-- Test API Key 1: tab_test_12345678901234567890123456789012
-- Test API Key 2: tab_test_98765432109876543210987654321098
INSERT INTO api_keys (id, merchant_id, key_hash, key_prefix, name, is_active, created_at, last_used_at)
VALUES 
  (
    '660e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440001',
    encode(sha256('tab_test_12345678901234567890123456789012'::bytea), 'hex'),
    'tab_test',
    'Development API Key',
    true,
    NOW(),
    NOW()
  ),
  (
    '660e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440002',
    encode(sha256('tab_test_98765432109876543210987654321098'::bytea), 'hex'),
    'tab_test',
    'Demo API Key',
    true,
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- Create sample tabs
INSERT INTO tabs (id, merchant_id, customer_email, customer_name, status, currency, subtotal, tax_amount, total_amount, paid_amount, metadata, created_at, updated_at)
VALUES 
  (
    '770e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440001',
    'customer1@example.com',
    'John Doe',
    'open',
    'USD',
    100.00,
    8.00,
    108.00,
    0.00,
    '{"notes": "First test tab"}',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days'
  ),
  (
    '770e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440001',
    'customer2@example.com',
    'Jane Smith',
    'partial',
    'USD',
    250.00,
    20.00,
    270.00,
    100.00,
    '{"notes": "Partial payment received"}',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    '770e8400-e29b-41d4-a716-446655440003',
    '550e8400-e29b-41d4-a716-446655440001',
    'customer3@example.com',
    'Bob Johnson',
    'paid',
    'USD',
    75.00,
    6.00,
    81.00,
    81.00,
    '{"notes": "Fully paid"}',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '7 days'
  )
ON CONFLICT (id) DO NOTHING;

-- Create line items for tabs
INSERT INTO line_items (id, tab_id, description, quantity, unit_price, total, metadata, created_at)
VALUES 
  -- Tab 1 line items
  (
    '880e8400-e29b-41d4-a716-446655440001',
    '770e8400-e29b-41d4-a716-446655440001',
    'Consulting Services',
    2,
    50.00,
    100.00,
    '{"category": "services"}',
    NOW() - INTERVAL '5 days'
  ),
  -- Tab 2 line items
  (
    '880e8400-e29b-41d4-a716-446655440002',
    '770e8400-e29b-41d4-a716-446655440002',
    'Web Development',
    5,
    40.00,
    200.00,
    '{"category": "development"}',
    NOW() - INTERVAL '3 days'
  ),
  (
    '880e8400-e29b-41d4-a716-446655440003',
    '770e8400-e29b-41d4-a716-446655440002',
    'Hosting Services',
    1,
    50.00,
    50.00,
    '{"category": "hosting"}',
    NOW() - INTERVAL '3 days'
  ),
  -- Tab 3 line items
  (
    '880e8400-e29b-41d4-a716-446655440004',
    '770e8400-e29b-41d4-a716-446655440003',
    'Logo Design',
    1,
    75.00,
    75.00,
    '{"category": "design"}',
    NOW() - INTERVAL '10 days'
  )
ON CONFLICT (id) DO NOTHING;

-- Create sample payments
INSERT INTO payments (id, tab_id, amount, currency, status, processor, processor_payment_id, metadata, created_at)
VALUES 
  (
    '990e8400-e29b-41d4-a716-446655440001',
    '770e8400-e29b-41d4-a716-446655440002',
    100.00,
    'USD',
    'succeeded',
    'stripe',
    'pi_test_partial_payment',
    '{"last4": "4242"}',
    NOW() - INTERVAL '1 day'
  ),
  (
    '990e8400-e29b-41d4-a716-446655440002',
    '770e8400-e29b-41d4-a716-446655440003',
    81.00,
    'USD',
    'succeeded',
    'stripe',
    'pi_test_full_payment',
    '{"last4": "5555"}',
    NOW() - INTERVAL '7 days'
  )
ON CONFLICT (id) DO NOTHING;

-- Output summary
DO $$
BEGIN
  RAISE NOTICE 'Seed data created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Test API Keys:';
  RAISE NOTICE '- Merchant 1: tab_test_12345678901234567890123456789012';
  RAISE NOTICE '- Merchant 2: tab_test_98765432109876543210987654321098';
  RAISE NOTICE '';
  RAISE NOTICE 'Test Merchants:';
  RAISE NOTICE '- test@example.com (Test Business Inc)';
  RAISE NOTICE '- demo@example.com (Demo Company LLC)';
END $$;