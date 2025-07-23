-- Remove duplicate indexes to improve performance
-- Each pair of indexes is identical, so we only need one

-- API Keys table
DROP INDEX IF EXISTS idx_api_keys_hash;  -- Keep idx_api_keys_key_hash
DROP INDEX IF EXISTS idx_api_keys_merchant;  -- Keep idx_api_keys_merchant_id

-- Invoices table  
DROP INDEX IF EXISTS idx_invoices_tab;  -- Keep idx_invoices_tab_id

-- Line Items table
DROP INDEX IF EXISTS idx_line_items_tab;  -- Keep idx_line_items_tab_id

-- Payments table
DROP INDEX IF EXISTS idx_payments_tab;  -- Keep idx_payments_tab_id

-- Tabs table
DROP INDEX IF EXISTS idx_tabs_merchant;  -- Keep idx_tabs_merchant_id

-- List remaining indexes for verification
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN ('api_keys', 'invoices', 'line_items', 'payments', 'tabs')
ORDER BY tablename, indexname;