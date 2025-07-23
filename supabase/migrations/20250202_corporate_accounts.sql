-- Corporate accounts table
CREATE TABLE corporate_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_number TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  tax_id TEXT,
  primary_contact_email TEXT NOT NULL,
  primary_contact_name TEXT,
  primary_contact_phone TEXT,
  billing_address JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Corporate account API keys
CREATE TABLE corporate_api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  corporate_account_id UUID REFERENCES corporate_accounts(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

-- Links corporate accounts to merchants with relationship-specific settings
CREATE TABLE corporate_merchant_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  corporate_account_id UUID REFERENCES corporate_accounts(id) ON DELETE CASCADE,
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('active', 'suspended', 'pending_approval')),
  credit_limit DECIMAL(10,2),
  payment_terms TEXT,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  billing_contact_email TEXT,
  billing_contact_name TEXT,
  shipping_addresses JSONB DEFAULT '[]',
  custom_pricing JSONB,
  metadata JSONB DEFAULT '{}',
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(corporate_account_id, merchant_id)
);

-- Authorized users for corporate accounts
CREATE TABLE corporate_account_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  corporate_account_id UUID REFERENCES corporate_accounts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT CHECK (role IN ('admin', 'purchaser', 'viewer', 'approver')),
  permissions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  merchant_access JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced tabs table (add corporate account linking)
ALTER TABLE tabs 
  ADD COLUMN corporate_account_id UUID REFERENCES corporate_accounts(id),
  ADD COLUMN corporate_relationship_id UUID REFERENCES corporate_merchant_relationships(id),
  ADD COLUMN purchase_order_number TEXT,
  ADD COLUMN department TEXT,
  ADD COLUMN cost_center TEXT;

-- Corporate account activity log
CREATE TABLE corporate_account_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  corporate_account_id UUID REFERENCES corporate_accounts(id) ON DELETE CASCADE,
  merchant_id UUID REFERENCES merchants(id),
  user_id UUID REFERENCES corporate_account_users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_corporate_accounts_number ON corporate_accounts(account_number);
CREATE INDEX idx_corporate_accounts_email ON corporate_accounts(primary_contact_email);
CREATE INDEX idx_corporate_api_keys_prefix ON corporate_api_keys(key_prefix);
CREATE INDEX idx_corporate_api_keys_hash ON corporate_api_keys(key_hash);
CREATE INDEX idx_cmr_corporate_account ON corporate_merchant_relationships(corporate_account_id);
CREATE INDEX idx_cmr_merchant ON corporate_merchant_relationships(merchant_id);
CREATE INDEX idx_cmr_status ON corporate_merchant_relationships(status);
CREATE INDEX idx_tabs_corporate ON tabs(corporate_account_id);
CREATE INDEX idx_tabs_corporate_relationship ON tabs(corporate_relationship_id);
CREATE INDEX idx_activity_corporate_account ON corporate_account_activity(corporate_account_id);
CREATE INDEX idx_activity_created ON corporate_account_activity(created_at);

-- Row Level Security policies
ALTER TABLE corporate_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE corporate_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE corporate_merchant_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE corporate_account_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE corporate_account_activity ENABLE ROW LEVEL SECURITY;

-- Corporate accounts are managed by merchants (future: dedicated corporate auth)
CREATE POLICY "Merchants can view corporate accounts with relationships" ON corporate_accounts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM corporate_merchant_relationships cmr
      WHERE cmr.corporate_account_id = corporate_accounts.id
      AND cmr.merchant_id = (SELECT auth.uid())
    )
  );

-- Merchants can manage relationships with their corporate accounts
CREATE POLICY "Merchants can view their corporate relationships" ON corporate_merchant_relationships
  FOR SELECT USING (merchant_id = (SELECT auth.uid()));

CREATE POLICY "Merchants can update their corporate relationships" ON corporate_merchant_relationships
  FOR UPDATE USING (merchant_id = (SELECT auth.uid()));

-- Corporate API keys are only visible to merchants who have relationships
CREATE POLICY "View corporate API keys" ON corporate_api_keys
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM corporate_merchant_relationships cmr
      WHERE cmr.corporate_account_id = corporate_api_keys.corporate_account_id
      AND cmr.merchant_id = (SELECT auth.uid())
    )
  );

-- Activity logs are visible to related merchants
CREATE POLICY "View corporate activity" ON corporate_account_activity
  FOR SELECT USING (
    merchant_id = (SELECT auth.uid()) OR
    EXISTS (
      SELECT 1 FROM corporate_merchant_relationships cmr
      WHERE cmr.corporate_account_id = corporate_account_activity.corporate_account_id
      AND cmr.merchant_id = (SELECT auth.uid())
    )
  );

-- Function to generate unique account numbers
CREATE OR REPLACE FUNCTION generate_corporate_account_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_number TEXT;
  done BOOLEAN DEFAULT FALSE;
BEGIN
  WHILE NOT done LOOP
    -- Generate a random 5-digit number
    new_number := 'CORP-' || LPAD(FLOOR(RANDOM() * 100000)::TEXT, 5, '0');
    
    -- Check if it already exists
    IF NOT EXISTS (SELECT 1 FROM public.corporate_accounts WHERE account_number = new_number) THEN
      done := TRUE;
    END IF;
  END LOOP;
  
  RETURN new_number;
END;
$$;

-- Trigger to auto-generate account numbers
CREATE OR REPLACE FUNCTION set_corporate_account_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.account_number IS NULL THEN
    NEW.account_number := public.generate_corporate_account_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_corporate_account_number_trigger
  BEFORE INSERT ON corporate_accounts
  FOR EACH ROW
  EXECUTE FUNCTION set_corporate_account_number();

-- Update timestamp triggers
CREATE TRIGGER update_corporate_accounts_updated_at
  BEFORE UPDATE ON corporate_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_corporate_merchant_relationships_updated_at
  BEFORE UPDATE ON corporate_merchant_relationships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_corporate_account_users_updated_at
  BEFORE UPDATE ON corporate_account_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();