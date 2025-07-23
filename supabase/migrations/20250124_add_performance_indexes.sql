-- Add performance indexes to improve query speed
-- Based on slow query analysis

-- 1. Foreign key indexes (these should always exist for good performance)
-- These are already created in the schema, but let's ensure they exist
CREATE INDEX IF NOT EXISTS idx_api_keys_merchant_id ON api_keys(merchant_id);
CREATE INDEX IF NOT EXISTS idx_tabs_merchant_id ON tabs(merchant_id);
CREATE INDEX IF NOT EXISTS idx_line_items_tab_id ON line_items(tab_id);
CREATE INDEX IF NOT EXISTS idx_payments_tab_id ON payments(tab_id);
CREATE INDEX IF NOT EXISTS idx_payments_processor_id ON payments(processor_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tab_id ON invoices(tab_id);
CREATE INDEX IF NOT EXISTS idx_merchant_processors_merchant_id ON merchant_processors(merchant_id);

-- 2. Composite indexes for common query patterns
-- For tabs queries that filter by merchant_id and status
CREATE INDEX IF NOT EXISTS idx_tabs_merchant_status ON tabs(merchant_id, status);

-- For payments queries that filter by tab_id and status
CREATE INDEX IF NOT EXISTS idx_payments_tab_status ON payments(tab_id, status);

-- For API key lookups (already exists but ensure it's there)
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);

-- 3. Indexes for common WHERE clauses
-- For tabs filtering by status
CREATE INDEX IF NOT EXISTS idx_tabs_status ON tabs(status);

-- For payments filtering by status
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- For line items by tab
CREATE INDEX IF NOT EXISTS idx_line_items_tab_created ON line_items(tab_id, created_at);

-- 4. Indexes for date-based queries (if you query by dates)
CREATE INDEX IF NOT EXISTS idx_tabs_created_at ON tabs(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- 5. Partial indexes for common conditions
-- For active merchant processors
CREATE INDEX IF NOT EXISTS idx_merchant_processors_active 
ON merchant_processors(merchant_id, processor_type) 
WHERE is_active = true;

-- For open/partial tabs (most commonly queried)
CREATE INDEX IF NOT EXISTS idx_tabs_open_partial 
ON tabs(merchant_id, created_at) 
WHERE status IN ('open', 'partial');

-- 6. Index for merchant email lookups
CREATE INDEX IF NOT EXISTS idx_merchants_email ON merchants(email);

-- Analyze tables to update query planner statistics
ANALYZE merchants;
ANALYZE api_keys;
ANALYZE tabs;
ANALYZE line_items;
ANALYZE payments;
ANALYZE invoices;
ANALYZE merchant_processors;