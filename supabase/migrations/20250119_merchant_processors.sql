-- Create merchant_processors table for storing payment processor configurations
CREATE TABLE IF NOT EXISTS merchant_processors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    processor_type TEXT NOT NULL CHECK (processor_type IN ('stripe', 'square', 'paypal', 'authorize_net')),
    is_active BOOLEAN DEFAULT true,
    is_test_mode BOOLEAN DEFAULT true,
    encrypted_credentials JSONB NOT NULL,
    webhook_secret TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(merchant_id, processor_type, is_test_mode)
);

-- Create index for faster lookups
CREATE INDEX idx_merchant_processors_merchant_id ON merchant_processors(merchant_id);
CREATE INDEX idx_merchant_processors_active ON merchant_processors(merchant_id, is_active, processor_type);

-- Enable RLS
ALTER TABLE merchant_processors ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Merchants can view own processors" ON merchant_processors
    FOR SELECT
    USING (merchant_id = auth.uid());

CREATE POLICY "Merchants can create own processors" ON merchant_processors
    FOR INSERT
    WITH CHECK (merchant_id = auth.uid());

CREATE POLICY "Merchants can update own processors" ON merchant_processors
    FOR UPDATE
    USING (merchant_id = auth.uid());

CREATE POLICY "Merchants can delete own processors" ON merchant_processors
    FOR DELETE
    USING (merchant_id = auth.uid());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_merchant_processors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER merchant_processors_updated_at
    BEFORE UPDATE ON merchant_processors
    FOR EACH ROW
    EXECUTE FUNCTION update_merchant_processors_updated_at();

-- Add processor_id to payments table to track which processor was used
ALTER TABLE payments ADD COLUMN IF NOT EXISTS processor_id UUID REFERENCES merchant_processors(id);
CREATE INDEX IF NOT EXISTS idx_payments_merchant_processor_id ON payments(processor_id);

-- Add processor_id to webhooks table (if exists) to track webhook source
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'webhooks') THEN
        ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS processor_id UUID REFERENCES merchant_processors(id);
        CREATE INDEX idx_webhooks_processor_id ON webhooks(processor_id);
    END IF;
END $$;