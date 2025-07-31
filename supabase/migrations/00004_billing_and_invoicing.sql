-- Billing Groups and Professional Invoicing
-- Handles invoice generation, billing groups, and payment allocation

-- Invoice status enum
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'viewed', 'paid', 'partial', 'overdue', 'canceled', 'void');

-- Invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tab_id UUID REFERENCES public.tabs(id) ON DELETE SET NULL,
  
  -- Invoice details
  invoice_number TEXT NOT NULL,
  status invoice_status DEFAULT 'draft',
  
  -- Billing info
  bill_to JSONB NOT NULL DEFAULT '{}',
  bill_from JSONB NOT NULL DEFAULT '{}',
  
  -- Dates
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  
  -- Amounts
  subtotal DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  amount_due DECIMAL(10,2) DEFAULT 0,
  
  -- Content
  line_items JSONB DEFAULT '[]',
  notes TEXT,
  terms TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id)
);

-- Billing groups (for grouping tabs/payments)
CREATE TABLE IF NOT EXISTS public.billing_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Group details
  name TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'manual' CHECK (type IN ('manual', 'rule_based', 'corporate_account')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  
  -- For corporate accounts
  corporate_org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  
  -- Billing settings
  invoice_prefix TEXT,
  invoice_settings JSONB DEFAULT '{}',
  payment_terms_days INTEGER DEFAULT 30,
  
  -- Current state
  total_amount DECIMAL(10,2) DEFAULT 0,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  balance_due DECIMAL(10,2) DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id)
);

-- Billing group members (tabs in a group)
CREATE TABLE IF NOT EXISTS public.billing_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_group_id UUID NOT NULL REFERENCES public.billing_groups(id) ON DELETE CASCADE,
  tab_id UUID NOT NULL REFERENCES public.tabs(id) ON DELETE CASCADE,
  
  -- Member details
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID REFERENCES public.users(id),
  
  UNIQUE(billing_group_id, tab_id)
);

-- Billing group rules (for automatic grouping)
CREATE TABLE IF NOT EXISTS public.billing_group_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_group_id UUID NOT NULL REFERENCES public.billing_groups(id) ON DELETE CASCADE,
  
  -- Rule configuration
  field TEXT NOT NULL, -- e.g., 'customer_email', 'customer_company', 'metadata.department'
  operator TEXT NOT NULL CHECK (operator IN ('equals', 'contains', 'starts_with', 'ends_with', 'regex')),
  value TEXT NOT NULL,
  
  -- Rule metadata
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment allocations (for tracking payments to billing groups)
CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  billing_group_id UUID NOT NULL REFERENCES public.billing_groups(id) ON DELETE CASCADE,
  
  -- Allocation details
  allocated_amount DECIMAL(10,2) NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(payment_id, billing_group_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_invoices_organization_id ON public.invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_billing_groups_organization_id ON public.billing_groups(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_groups_status ON public.billing_groups(status);
CREATE INDEX IF NOT EXISTS idx_billing_group_members_group_id ON public.billing_group_members(billing_group_id);
CREATE INDEX IF NOT EXISTS idx_billing_group_members_tab_id ON public.billing_group_members(tab_id);
CREATE INDEX IF NOT EXISTS idx_billing_group_rules_group_id ON public.billing_group_rules(billing_group_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment_id ON public.payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_group_id ON public.payment_allocations(billing_group_id);

-- Add triggers
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_billing_groups_updated_at BEFORE UPDATE ON public.billing_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_group_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

-- Add unique constraint for invoice numbers per organization
CREATE UNIQUE INDEX idx_invoices_org_number ON public.invoices(organization_id, invoice_number);

-- Add foreign key for billing_group_id in tabs
ALTER TABLE public.tabs 
  ADD CONSTRAINT tabs_billing_group_id_fkey 
  FOREIGN KEY (billing_group_id) 
  REFERENCES public.billing_groups(id) 
  ON DELETE SET NULL;

-- Add foreign key for billing_group_id in payments
ALTER TABLE public.payments 
  ADD CONSTRAINT payments_billing_group_id_fkey 
  FOREIGN KEY (billing_group_id) 
  REFERENCES public.billing_groups(id) 
  ON DELETE SET NULL;