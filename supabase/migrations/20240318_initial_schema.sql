-- Initial schema setup with security enabled

-- Create tables
CREATE TABLE IF NOT EXISTS merchants (
  id uuid PRIMARY KEY DEFAULT auth.uid(),
  business_name text NOT NULL,
  email text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL,
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  customer_email text NOT NULL,
  customer_name text,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  paid_amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'partial', 'paid', 'disputed', 'refunded')),
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id uuid NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL,
  total numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id uuid NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded')),
  processor text NOT NULL DEFAULT 'stripe',
  processor_payment_id text NOT NULL,
  failure_reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id uuid NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  sent_at timestamptz,
  viewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_merchant ON api_keys(merchant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_tabs_merchant ON tabs(merchant_id);
CREATE INDEX IF NOT EXISTS idx_tabs_status ON tabs(status);
CREATE INDEX IF NOT EXISTS idx_tabs_created ON tabs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_line_items_tab ON line_items(tab_id);
CREATE INDEX IF NOT EXISTS idx_payments_tab ON payments(tab_id);
CREATE INDEX IF NOT EXISTS idx_payments_processor_id ON payments(processor_payment_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tab ON invoices(tab_id);

-- Add unique constraint for API keys
ALTER TABLE api_keys ADD CONSTRAINT api_keys_key_hash_unique UNIQUE (key_hash);

-- CRITICAL: Enable Row Level Security on all tables
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Merchants policies
CREATE POLICY "Merchants can view own record" 
ON merchants FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Merchants can update own record" 
ON merchants FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Users can create merchant account" 
ON merchants FOR INSERT 
WITH CHECK (auth.uid() = id);

-- API Keys policies
CREATE POLICY "Merchants can view own API keys" 
ON api_keys FOR SELECT 
USING (auth.uid() = merchant_id);

CREATE POLICY "Merchants can create own API keys" 
ON api_keys FOR INSERT 
WITH CHECK (auth.uid() = merchant_id);

CREATE POLICY "Merchants can update own API keys" 
ON api_keys FOR UPDATE 
USING (auth.uid() = merchant_id);

CREATE POLICY "Merchants can delete own API keys" 
ON api_keys FOR DELETE 
USING (auth.uid() = merchant_id);

-- Tabs policies
CREATE POLICY "Merchants can view own tabs" 
ON tabs FOR SELECT 
USING (auth.uid() = merchant_id);

CREATE POLICY "Merchants can create own tabs" 
ON tabs FOR INSERT 
WITH CHECK (auth.uid() = merchant_id);

CREATE POLICY "Merchants can update own tabs" 
ON tabs FOR UPDATE 
USING (auth.uid() = merchant_id);

CREATE POLICY "Merchants can delete own tabs" 
ON tabs FOR DELETE 
USING (auth.uid() = merchant_id);

CREATE POLICY "Public can view tabs for payment" 
ON tabs FOR SELECT 
USING (true);

-- Line Items policies
CREATE POLICY "Merchants can view line items for own tabs" 
ON line_items FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM tabs 
        WHERE tabs.id = line_items.tab_id 
        AND tabs.merchant_id = auth.uid()
    )
);

CREATE POLICY "Merchants can create line items for own tabs" 
ON line_items FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM tabs 
        WHERE tabs.id = line_items.tab_id 
        AND tabs.merchant_id = auth.uid()
    )
);

CREATE POLICY "Merchants can update line items for own tabs" 
ON line_items FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM tabs 
        WHERE tabs.id = line_items.tab_id 
        AND tabs.merchant_id = auth.uid()
    )
);

CREATE POLICY "Merchants can delete line items for own tabs" 
ON line_items FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM tabs 
        WHERE tabs.id = line_items.tab_id 
        AND tabs.merchant_id = auth.uid()
    )
);

CREATE POLICY "Public can view line items for payment" 
ON line_items FOR SELECT 
USING (true);

-- Payments policies
CREATE POLICY "Merchants can view payments for own tabs" 
ON payments FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM tabs 
        WHERE tabs.id = payments.tab_id 
        AND tabs.merchant_id = auth.uid()
    )
);

-- Public can view payments when viewing tabs (for payment confirmation)
CREATE POLICY "Public can view payments for payment confirmation" 
ON payments FOR SELECT 
USING (true);

-- Invoices policies
CREATE POLICY "Merchants can view invoices for own tabs" 
ON invoices FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM tabs 
        WHERE tabs.id = invoices.tab_id 
        AND tabs.merchant_id = auth.uid()
    )
);

CREATE POLICY "Merchants can create invoices for own tabs" 
ON invoices FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM tabs 
        WHERE tabs.id = invoices.tab_id 
        AND tabs.merchant_id = auth.uid()
    )
);

CREATE POLICY "Merchants can update invoices for own tabs" 
ON invoices FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM tabs 
        WHERE tabs.id = invoices.tab_id 
        AND tabs.merchant_id = auth.uid()
    )
);

CREATE POLICY "Merchants can delete invoices for own tabs" 
ON invoices FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM tabs 
        WHERE tabs.id = invoices.tab_id 
        AND tabs.merchant_id = auth.uid()
    )
);

-- Create update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_merchants_updated_at BEFORE UPDATE ON merchants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tabs_updated_at BEFORE UPDATE ON tabs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create RPC function for dashboard stats
CREATE OR REPLACE FUNCTION get_merchant_stats()
RETURNS TABLE (
  total_tabs bigint,
  open_tabs bigint,
  total_revenue numeric,
  pending_revenue numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = '' -- Set search path to empty string for security
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT t.id) as total_tabs,
    COUNT(DISTINCT t.id) FILTER (WHERE t.status IN ('open', 'partial')) as open_tabs,
    COALESCE(SUM(DISTINCT t.paid_amount), 0) as total_revenue,
    COALESCE(SUM(DISTINCT t.total_amount - t.paid_amount) FILTER (WHERE t.status IN ('open', 'partial')), 0) as pending_revenue
  FROM public.tabs t
  WHERE t.merchant_id = auth.uid();
END;
$$;