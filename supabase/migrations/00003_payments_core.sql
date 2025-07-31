-- Core Payment Tables
-- Creates tabs, line items, payments, and related structures

-- Payment status enum
CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'canceled', 'refunded', 'partially_refunded');

-- Tab status enum  
CREATE TYPE tab_status AS ENUM ('draft', 'open', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'canceled', 'refunded');

-- Tabs table (main payment collection entity)
CREATE TABLE IF NOT EXISTS public.tabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Tab details
  tab_number TEXT NOT NULL,
  status tab_status DEFAULT 'draft',
  currency TEXT DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  
  -- Customer info
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  customer_company TEXT,
  customer_metadata JSONB DEFAULT '{}',
  
  -- Totals (stored for performance)
  subtotal DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  amount_due DECIMAL(10,2) DEFAULT 0,
  
  -- Dates
  due_date DATE,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  
  -- Settings
  tax_rate DECIMAL(5,2) DEFAULT 0,
  notes TEXT,
  memo TEXT,
  payment_link TEXT,
  short_link TEXT,
  settings JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  -- Source tracking
  source TEXT DEFAULT 'dashboard',
  source_metadata JSONB DEFAULT '{}',
  
  -- Relationships
  billing_group_id UUID,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id)
);

-- Line items
CREATE TABLE IF NOT EXISTS public.line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id UUID NOT NULL REFERENCES public.tabs(id) ON DELETE CASCADE,
  
  -- Item details
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  
  -- Optional fields
  sku TEXT,
  category TEXT,
  tax_rate DECIMAL(5,2),
  discount_rate DECIMAL(5,2),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Ordering
  position INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id UUID NOT NULL REFERENCES public.tabs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Payment details
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status payment_status DEFAULT 'pending',
  
  -- Processor info
  processor TEXT NOT NULL,
  processor_payment_id TEXT,
  processor_customer_id TEXT,
  processor_payment_method_id TEXT,
  processor_metadata JSONB DEFAULT '{}',
  
  -- Additional info
  description TEXT,
  receipt_url TEXT,
  refunded_amount DECIMAL(10,2) DEFAULT 0,
  failure_reason TEXT,
  
  -- Billing group allocation
  billing_group_id UUID,
  allocated_amount DECIMAL(10,2),
  
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- API Keys table
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Key details
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  last_four TEXT NOT NULL,
  
  -- Permissions and scope
  scope TEXT DEFAULT 'full' CHECK (scope IN ('full', 'read', 'write')),
  permissions JSONB DEFAULT '{"tabs": true, "payments": true, "customers": true, "webhooks": true}',
  
  -- Usage tracking
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_tabs_organization_id ON public.tabs(organization_id);
CREATE INDEX IF NOT EXISTS idx_tabs_status ON public.tabs(status);
CREATE INDEX IF NOT EXISTS idx_tabs_customer_email ON public.tabs(customer_email);
CREATE INDEX IF NOT EXISTS idx_tabs_created_at ON public.tabs(created_at);
CREATE INDEX IF NOT EXISTS idx_tabs_tab_number ON public.tabs(tab_number);
CREATE INDEX IF NOT EXISTS idx_line_items_tab_id ON public.line_items(tab_id);
CREATE INDEX IF NOT EXISTS idx_line_items_position ON public.line_items(position);
CREATE INDEX IF NOT EXISTS idx_payments_tab_id ON public.payments(tab_id);
CREATE INDEX IF NOT EXISTS idx_payments_organization_id ON public.payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_processor ON public.payments(processor);
CREATE INDEX IF NOT EXISTS idx_api_keys_organization_id ON public.api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON public.api_keys(key_prefix);

-- Add triggers
CREATE TRIGGER update_tabs_updated_at BEFORE UPDATE ON public.tabs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_line_items_updated_at BEFORE UPDATE ON public.line_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Add unique constraint for tab numbers per organization
CREATE UNIQUE INDEX idx_tabs_org_number ON public.tabs(organization_id, tab_number);