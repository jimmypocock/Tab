-- Drop existing simple invoices table if it exists
DROP TABLE IF EXISTS invoices CASCADE;

-- Enhanced invoice structure with versioning and business model support
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID REFERENCES merchants(id) NOT NULL,
  tab_id UUID REFERENCES tabs(id),
  
  -- Invoice identification
  invoice_number TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  parent_invoice_id UUID REFERENCES invoices(id),
  
  -- Customer info (denormalized for immutability)
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  customer_id UUID REFERENCES corporate_accounts(id),
  
  -- Invoice details
  status TEXT CHECK (status IN ('draft', 'sent', 'viewed', 'partial', 'paid', 'void', 'uncollectible')) DEFAULT 'draft',
  invoice_type TEXT CHECK (invoice_type IN ('standard', 'split', 'hotel_folio', 'milestone', 'recurring')) DEFAULT 'standard',
  
  -- Dates
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  sent_at TIMESTAMPTZ,
  first_viewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  
  -- Amounts
  currency TEXT DEFAULT 'USD',
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  balance DECIMAL(10,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  
  -- Payment terms
  payment_terms TEXT,
  late_fee_percentage DECIMAL(5,2),
  
  -- References
  public_url TEXT UNIQUE,
  external_reference TEXT,
  purchase_order_number TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  billing_address JSONB,
  shipping_address JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint for invoice numbers per merchant
  UNIQUE(merchant_id, invoice_number)
);

-- Invoice line items with detailed tracking
CREATE TABLE invoice_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  
  -- Line item details
  line_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  
  -- Source tracking
  source_type TEXT CHECK (source_type IN ('tab_item', 'manual', 'recurring', 'adjustment')) DEFAULT 'manual',
  source_id UUID,
  
  -- Grouping for split bills
  group_id UUID,
  split_group TEXT,
  
  -- Amounts
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  
  -- Calculated amounts
  subtotal DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  discount_amount DECIMAL(10,2) GENERATED ALWAYS AS ((quantity * unit_price) * COALESCE(discount_percentage, 0) / 100) STORED,
  tax_amount DECIMAL(10,2) GENERATED ALWAYS AS (((quantity * unit_price) - ((quantity * unit_price) * COALESCE(discount_percentage, 0) / 100)) * COALESCE(tax_rate, 0) / 100) STORED,
  total_amount DECIMAL(10,2) GENERATED ALWAYS AS ((quantity * unit_price) - ((quantity * unit_price) * COALESCE(discount_percentage, 0) / 100) + (((quantity * unit_price) - ((quantity * unit_price) * COALESCE(discount_percentage, 0) / 100)) * COALESCE(tax_rate, 0) / 100)) STORED,
  
  -- Payment tracking
  allocated_amount DECIMAL(10,2) DEFAULT 0,
  remaining_amount DECIMAL(10,2) GENERATED ALWAYS AS (((quantity * unit_price) - ((quantity * unit_price) * COALESCE(discount_percentage, 0) / 100) + (((quantity * unit_price) - ((quantity * unit_price) * COALESCE(discount_percentage, 0) / 100)) * COALESCE(tax_rate, 0) / 100)) - allocated_amount) STORED,
  
  -- Hotel-specific fields
  service_date DATE,
  room_number TEXT,
  folio_category TEXT,
  
  -- Professional services fields
  milestone_id UUID,
  hours_worked DECIMAL(10,2),
  hourly_rate DECIMAL(10,2),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique line numbers per invoice
  UNIQUE(invoice_id, line_number)
);

-- Payment tracking at line-item level
CREATE TABLE payment_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  invoice_line_item_id UUID REFERENCES invoice_line_items(id) ON DELETE CASCADE,
  
  -- Allocation details
  amount DECIMAL(10,2) NOT NULL,
  allocation_method TEXT CHECK (allocation_method IN ('manual', 'fifo', 'proportional', 'priority')) DEFAULT 'fifo',
  
  -- Timestamps
  allocated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure no double allocation
  UNIQUE(payment_id, invoice_line_item_id)
);

-- Split invoice management
CREATE TABLE invoice_splits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_invoice_id UUID REFERENCES invoices(id) NOT NULL,
  
  -- Split configuration
  split_type TEXT CHECK (split_type IN ('by_items', 'by_percentage', 'by_amount', 'custom')) NOT NULL,
  split_config JSONB NOT NULL,
  
  -- Status tracking
  status TEXT CHECK (status IN ('pending', 'confirmed', 'cancelled')) DEFAULT 'pending',
  confirmed_at TIMESTAMPTZ,
  confirmed_by TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hotel folio management
CREATE TABLE hotel_folios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id) UNIQUE NOT NULL,
  
  -- Folio details
  folio_number TEXT NOT NULL,
  folio_type TEXT CHECK (folio_type IN ('master', 'guest', 'company', 'group')) NOT NULL,
  parent_folio_id UUID REFERENCES hotel_folios(id),
  
  -- Guest information
  guest_name TEXT,
  room_number TEXT,
  check_in_date DATE,
  check_out_date DATE,
  
  -- Direct billing
  direct_bill_company_id UUID REFERENCES corporate_accounts(id),
  authorization_code TEXT,
  
  -- Deposit tracking
  deposit_amount DECIMAL(10,2) DEFAULT 0,
  deposit_applied DECIMAL(10,2) DEFAULT 0,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Professional services milestones
CREATE TABLE project_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID REFERENCES merchants(id) NOT NULL,
  tab_id UUID REFERENCES tabs(id),
  
  -- Milestone details
  milestone_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Billing configuration
  billing_type TEXT CHECK (billing_type IN ('fixed_price', 'time_materials', 'retainer', 'percentage')) NOT NULL,
  amount DECIMAL(10,2),
  percentage DECIMAL(5,2),
  
  -- Status tracking
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'approved', 'invoiced')) DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  
  -- Invoice tracking
  invoice_id UUID REFERENCES invoices(id),
  invoiced_at TIMESTAMPTZ,
  
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(merchant_id, tab_id, milestone_number)
);

-- Retainer accounts for professional services
CREATE TABLE retainer_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID REFERENCES merchants(id) NOT NULL,
  customer_id UUID REFERENCES corporate_accounts(id),
  
  -- Account details
  account_name TEXT NOT NULL,
  initial_balance DECIMAL(10,2) NOT NULL,
  current_balance DECIMAL(10,2) NOT NULL,
  minimum_balance DECIMAL(10,2) DEFAULT 0,
  
  -- Replenishment rules
  auto_replenish BOOLEAN DEFAULT false,
  replenish_amount DECIMAL(10,2),
  replenish_threshold DECIMAL(10,2),
  
  -- Status
  status TEXT CHECK (status IN ('active', 'paused', 'depleted', 'closed')) DEFAULT 'active',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Retainer transactions
CREATE TABLE retainer_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  retainer_account_id UUID REFERENCES retainer_accounts(id) NOT NULL,
  
  -- Transaction details
  transaction_type TEXT CHECK (transaction_type IN ('deposit', 'withdrawal', 'adjustment')) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  
  -- References
  invoice_id UUID REFERENCES invoices(id),
  payment_id UUID REFERENCES payments(id),
  
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoice audit log for compliance
CREATE TABLE invoice_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id) NOT NULL,
  action TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changed_by_type TEXT CHECK (changed_by_type IN ('merchant', 'customer', 'system')),
  previous_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_invoices_merchant_status ON invoices(merchant_id, status);
CREATE INDEX idx_invoices_customer ON invoices(customer_email);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_invoices_due_date ON invoices(due_date) WHERE status IN ('sent', 'viewed', 'partial');
CREATE INDEX idx_invoices_tab ON invoices(tab_id) WHERE tab_id IS NOT NULL;
CREATE INDEX idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);
CREATE INDEX idx_invoice_line_items_remaining ON invoice_line_items(invoice_id) WHERE remaining_amount > 0;
CREATE INDEX idx_payment_allocations_payment ON payment_allocations(payment_id);
CREATE INDEX idx_payment_allocations_invoice ON payment_allocations(invoice_id);
CREATE INDEX idx_hotel_folios_room ON hotel_folios(room_number) WHERE folio_type = 'guest';
CREATE INDEX idx_milestones_tab ON project_milestones(tab_id) WHERE tab_id IS NOT NULL;
CREATE INDEX idx_milestones_status ON project_milestones(merchant_id, status);
CREATE INDEX idx_retainer_accounts_customer ON retainer_accounts(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_audit_log_invoice ON invoice_audit_log(invoice_id);
CREATE INDEX idx_audit_log_created ON invoice_audit_log(created_at);

-- Row Level Security
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_folios ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE retainer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE retainer_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for merchants
CREATE POLICY "Merchants can view their own invoices" ON invoices
  FOR SELECT USING (merchant_id = (SELECT auth.uid()));

CREATE POLICY "Merchants can create invoices" ON invoices
  FOR INSERT WITH CHECK (merchant_id = (SELECT auth.uid()));

CREATE POLICY "Merchants can update their draft invoices" ON invoices
  FOR UPDATE USING (
    merchant_id = (SELECT auth.uid()) 
    AND status = 'draft'
  );

-- RLS for invoice line items (inherit from invoice)
CREATE POLICY "Access invoice line items through invoice" ON invoice_line_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM invoices 
      WHERE invoices.id = invoice_line_items.invoice_id 
      AND invoices.merchant_id = (SELECT auth.uid())
    )
  );

-- RLS for payment allocations
CREATE POLICY "View payment allocations through invoice" ON payment_allocations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM invoices 
      WHERE invoices.id = payment_allocations.invoice_id 
      AND invoices.merchant_id = (SELECT auth.uid())
    )
  );

-- Function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number(merchant_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_year INTEGER;
  last_number INTEGER;
  new_number TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  
  -- Get the last invoice number for this merchant this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 'INV-\d{4}-(\d{4})') AS INTEGER)), 0)
  INTO last_number
  FROM public.invoices
  WHERE merchant_id = merchant_uuid
  AND invoice_number LIKE 'INV-' || current_year || '-%';
  
  -- Generate new number
  new_number := 'INV-' || current_year || '-' || LPAD((last_number + 1)::TEXT, 4, '0');
  
  RETURN new_number;
END;
$$;

-- Function to update invoice totals when line items change
CREATE OR REPLACE FUNCTION update_invoice_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  invoice_subtotal DECIMAL(10,2);
  invoice_tax DECIMAL(10,2);
  invoice_discount DECIMAL(10,2);
BEGIN
  -- Calculate new totals
  SELECT 
    COALESCE(SUM(subtotal), 0),
    COALESCE(SUM(tax_amount), 0),
    COALESCE(SUM(discount_amount), 0)
  INTO invoice_subtotal, invoice_tax, invoice_discount
  FROM public.invoice_line_items
  WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  -- Update invoice
  UPDATE public.invoices
  SET 
    subtotal = invoice_subtotal,
    tax_amount = invoice_tax,
    discount_amount = invoice_discount,
    total_amount = invoice_subtotal + invoice_tax - invoice_discount,
    updated_at = NOW()
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  RETURN NEW;
END;
$$;

-- Trigger for invoice total updates
CREATE TRIGGER update_invoice_totals_trigger
AFTER INSERT OR UPDATE OR DELETE ON invoice_line_items
FOR EACH ROW
EXECUTE FUNCTION update_invoice_totals();

-- Function to allocate payment to invoice
CREATE OR REPLACE FUNCTION allocate_payment_to_invoice(
  p_payment_id UUID,
  p_invoice_id UUID,
  p_amount DECIMAL(10,2),
  p_method TEXT DEFAULT 'fifo'
)
RETURNS TABLE (
  line_item_id UUID,
  allocated_amount DECIMAL(10,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  remaining_amount DECIMAL(10,2);
  line_record RECORD;
BEGIN
  remaining_amount := p_amount;
  
  -- Get line items ordered by line number (FIFO)
  FOR line_record IN
    SELECT id, remaining_amount as available
    FROM public.invoice_line_items
    WHERE invoice_id = p_invoice_id
    AND remaining_amount > 0
    ORDER BY line_number
  LOOP
    IF remaining_amount <= 0 THEN
      EXIT;
    END IF;
    
    -- Calculate allocation for this line item
    IF line_record.available <= remaining_amount THEN
      -- Allocate full remaining amount of line item
      INSERT INTO public.payment_allocations (payment_id, invoice_id, invoice_line_item_id, amount, allocation_method)
      VALUES (p_payment_id, p_invoice_id, line_record.id, line_record.available, p_method);
      
      UPDATE public.invoice_line_items
      SET allocated_amount = allocated_amount + line_record.available
      WHERE id = line_record.id;
      
      remaining_amount := remaining_amount - line_record.available;
      
      RETURN QUERY SELECT line_record.id, line_record.available;
    ELSE
      -- Allocate partial amount
      INSERT INTO public.payment_allocations (payment_id, invoice_id, invoice_line_item_id, amount, allocation_method)
      VALUES (p_payment_id, p_invoice_id, line_record.id, remaining_amount, p_method);
      
      UPDATE public.invoice_line_items
      SET allocated_amount = allocated_amount + remaining_amount
      WHERE id = line_record.id;
      
      RETURN QUERY SELECT line_record.id, remaining_amount;
      
      remaining_amount := 0;
    END IF;
  END LOOP;
  
  -- Update invoice paid amount
  UPDATE public.invoices
  SET 
    paid_amount = paid_amount + (p_amount - remaining_amount),
    status = CASE 
      WHEN paid_amount + (p_amount - remaining_amount) >= total_amount THEN 'paid'
      WHEN paid_amount + (p_amount - remaining_amount) > 0 THEN 'partial'
      ELSE status
    END,
    paid_at = CASE
      WHEN paid_amount + (p_amount - remaining_amount) >= total_amount THEN NOW()
      ELSE paid_at
    END
  WHERE id = p_invoice_id;
  
  RETURN;
END;
$$;

-- Update timestamp triggers
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_retainer_accounts_updated_at
  BEFORE UPDATE ON retainer_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();