# Professional Invoicing System Architecture

## Overview

This architecture supports multiple business models while maintaining data integrity and preventing conflicts between different use cases. The key principle is **separation of concerns**: tabs collect items, invoices request payment, and payments are allocated according to business rules.

## Core Concepts

### 1. Tab vs Invoice Separation
- **Tab**: A container for line items (like a shopping cart or order)
- **Invoice**: A formal payment request for specific items/amounts from a tab
- **Payment**: Money received that gets allocated to invoice line items

### 2. Key Architecture Decisions

#### Decision 1: Invoice Immutability
**Choice**: Invoices are immutable once sent
**Rationale**: 
- Maintains audit trail for compliance
- Prevents disputes about changing amounts
- Amendments create new invoice versions

#### Decision 2: Line-Item Level Tracking
**Choice**: Track payments at the line-item level, not just invoice level
**Rationale**:
- Enables partial payments per item
- Supports split bills naturally
- Required for hotel folios and professional services

#### Decision 3: Flexible Payment Allocation
**Choice**: Support multiple allocation strategies (FIFO, proportional, manual)
**Rationale**:
- Different businesses have different needs
- Allows customer preference in some cases
- Required for complex billing scenarios

## Database Schema Design

```sql
-- Enhanced invoice structure with versioning
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID REFERENCES merchants(id) NOT NULL,
  tab_id UUID REFERENCES tabs(id),
  
  -- Invoice identification
  invoice_number TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  parent_invoice_id UUID REFERENCES invoices(id), -- For amendments
  
  -- Customer info (denormalized for immutability)
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  customer_id UUID REFERENCES corporate_accounts(id), -- Optional
  
  -- Invoice details
  status TEXT CHECK (status IN ('draft', 'sent', 'viewed', 'partial', 'paid', 'void', 'uncollectible')),
  invoice_type TEXT CHECK (invoice_type IN ('standard', 'split', 'hotel_folio', 'milestone', 'recurring')),
  
  -- Dates
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  sent_at TIMESTAMPTZ,
  first_viewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  
  -- Amounts
  currency TEXT DEFAULT 'USD',
  subtotal DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
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
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  
  -- Line item details
  line_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  category TEXT, -- 'room', 'food', 'beverage', 'service', 'tax', etc.
  
  -- Source tracking
  source_type TEXT CHECK (source_type IN ('tab_item', 'manual', 'recurring', 'adjustment')),
  source_id UUID, -- References line_items(id) or other source
  
  -- Grouping for split bills
  group_id UUID, -- For grouping shared items
  split_group TEXT, -- 'shared', 'seat_1', 'seat_2', etc.
  
  -- Amounts
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  
  -- Calculated amounts
  subtotal DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  discount_amount DECIMAL(10,2) GENERATED ALWAYS AS (subtotal * COALESCE(discount_percentage, 0) / 100) STORED,
  tax_amount DECIMAL(10,2) GENERATED ALWAYS AS ((subtotal - discount_amount) * COALESCE(tax_rate, 0) / 100) STORED,
  total_amount DECIMAL(10,2) GENERATED ALWAYS AS (subtotal - discount_amount + tax_amount) STORED,
  
  -- Payment tracking
  allocated_amount DECIMAL(10,2) DEFAULT 0,
  remaining_amount DECIMAL(10,2) GENERATED ALWAYS AS (total_amount - allocated_amount) STORED,
  
  -- Hotel-specific fields
  service_date DATE,
  room_number TEXT,
  folio_category TEXT, -- 'room_charge', 'incidental', 'tax', 'fee'
  
  -- Professional services fields
  milestone_id UUID,
  hours_worked DECIMAL(10,2),
  hourly_rate DECIMAL(10,2),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment tracking at line-item level
CREATE TABLE payment_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  invoice_line_item_id UUID REFERENCES invoice_line_items(id) ON DELETE CASCADE,
  
  -- Allocation details
  amount DECIMAL(10,2) NOT NULL,
  allocation_method TEXT CHECK (allocation_method IN ('manual', 'fifo', 'proportional', 'priority')),
  
  -- Timestamps
  allocated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure no double allocation
  UNIQUE(payment_id, invoice_line_item_id)
);

-- Split invoice management
CREATE TABLE invoice_splits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_invoice_id UUID REFERENCES invoices(id),
  
  -- Split configuration
  split_type TEXT CHECK (split_type IN ('by_items', 'by_percentage', 'by_amount', 'custom')),
  split_config JSONB NOT NULL, -- Configuration for the split
  
  -- Status tracking
  status TEXT CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  confirmed_at TIMESTAMPTZ,
  confirmed_by TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hotel folio management
CREATE TABLE hotel_folios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id) UNIQUE,
  
  -- Folio details
  folio_number TEXT NOT NULL,
  folio_type TEXT CHECK (folio_type IN ('master', 'guest', 'company', 'group')),
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
  merchant_id UUID REFERENCES merchants(id),
  tab_id UUID REFERENCES tabs(id),
  
  -- Milestone details
  milestone_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Billing configuration
  billing_type TEXT CHECK (billing_type IN ('fixed_price', 'time_materials', 'retainer', 'percentage')),
  amount DECIMAL(10,2), -- For fixed price
  percentage DECIMAL(5,2), -- For percentage of total
  
  -- Status tracking
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'approved', 'invoiced')),
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
  merchant_id UUID REFERENCES merchants(id),
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
  status TEXT CHECK (status IN ('active', 'paused', 'depleted', 'closed')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Retainer transactions
CREATE TABLE retainer_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  retainer_account_id UUID REFERENCES retainer_accounts(id),
  
  -- Transaction details
  transaction_type TEXT CHECK (transaction_type IN ('deposit', 'withdrawal', 'adjustment')),
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  
  -- References
  invoice_id UUID REFERENCES invoices(id),
  payment_id UUID REFERENCES payments(id),
  
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_invoices_merchant_status ON invoices(merchant_id, status);
CREATE INDEX idx_invoices_customer ON invoices(customer_email);
CREATE INDEX idx_invoices_due_date ON invoices(due_date) WHERE status IN ('sent', 'viewed', 'partial');
CREATE INDEX idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);
CREATE INDEX idx_invoice_line_items_remaining ON invoice_line_items(invoice_id) WHERE remaining_amount > 0;
CREATE INDEX idx_payment_allocations_payment ON payment_allocations(payment_id);
CREATE INDEX idx_payment_allocations_invoice ON payment_allocations(invoice_id);
CREATE INDEX idx_hotel_folios_room ON hotel_folios(room_number) WHERE folio_type = 'guest';
CREATE INDEX idx_milestones_tab ON project_milestones(tab_id);
CREATE INDEX idx_milestones_status ON project_milestones(merchant_id, status);
```

## Conflict Prevention Strategies

### 1. User Access Control
```typescript
interface InvoiceAccessControl {
  // Merchants can only access their own invoices
  merchantAccess: (merchantId: string, invoiceId: string) => boolean
  
  // Corporate accounts can only access invoices they're associated with
  corporateAccess: (corporateId: string, invoiceId: string) => boolean
  
  // Public access requires valid public URL token
  publicAccess: (token: string, invoiceId: string) => boolean
}
```

### 2. State Machine for Invoice Status
```typescript
const invoiceStateMachine = {
  draft: ['sent', 'void'],
  sent: ['viewed', 'partial', 'paid', 'void'],
  viewed: ['partial', 'paid', 'void', 'uncollectible'],
  partial: ['paid', 'void', 'uncollectible'],
  paid: ['void'], // Only for refunds
  void: [], // Terminal state
  uncollectible: [] // Terminal state
}
```

### 3. Concurrent Update Prevention
- Use optimistic locking with version numbers
- Check current state before transitions
- Use database transactions for multi-table updates

## Implementation Patterns

### 1. Restaurant Bill Splitting
```typescript
class RestaurantBillSplitter {
  // Split by seats
  async splitBySeats(invoiceId: string, seatAssignments: Map<string, string[]>) {
    // Each seat gets their own invoice
    // Shared items are duplicated with proportional amounts
  }
  
  // Split by percentage
  async splitByPercentage(invoiceId: string, percentages: Map<string, number>) {
    // Validate percentages sum to 100
    // Create invoices with proportional amounts
  }
  
  // Transfer items between bills
  async transferItems(fromInvoiceId: string, toInvoiceId: string, itemIds: string[]) {
    // Validate both invoices are in draft state
    // Move items maintaining payment allocations
  }
}
```

### 2. Hotel Folio Management
```typescript
class HotelFolioManager {
  // Create master folio with sub-folios
  async createMasterFolio(reservation: Reservation) {
    // Master folio for all charges
    // Guest folios for individual rooms
    // Company folio for direct billing
  }
  
  // Route charges to appropriate folio
  async routeCharge(charge: Charge, folioType: 'room' | 'incidental' | 'company') {
    // Determine target folio based on rules
    // Add line item with proper categorization
  }
}
```

### 3. Professional Services Billing
```typescript
class ProfessionalServicesBilling {
  // Milestone-based invoicing
  async invoiceMilestone(milestoneId: string) {
    // Verify milestone is approved
    // Create invoice with milestone details
    // Update milestone status
  }
  
  // Progress billing
  async createProgressInvoice(projectId: string, percentage: number) {
    // Calculate amount based on total project value
    // Track cumulative billing
  }
  
  // Retainer management
  async drawFromRetainer(retainerId: string, amount: number) {
    // Check sufficient balance
    // Create transaction record
    // Trigger replenishment if needed
  }
}
```

## Security Considerations

### 1. Data Isolation
- RLS policies ensure merchants only see their data
- Corporate accounts limited to their relationships
- Public invoice access requires secure tokens

### 2. Audit Trail
- All invoice changes logged with timestamps
- Payment allocations tracked with method
- User actions recorded for compliance

### 3. Financial Integrity
- Database constraints prevent over-allocation
- Calculated fields ensure consistency
- Transactions for atomic updates

## Questions for Implementation

1. **Invoice Numbering**: Should we use sequential numbers per merchant or a global sequence?
2. **Tax Calculation**: Should tax be calculated at line-item level or invoice level?
3. **Currency Support**: Single currency per merchant or multi-currency invoices?
4. **Payment Methods**: Should we track which payment method was used for allocations?
5. **Refunds**: How should partial refunds affect payment allocations?

## Next Steps

1. Implement core invoice tables and relationships
2. Build payment allocation engine
3. Create use-case specific services
4. Develop UI components for each business model
5. Add comprehensive testing for edge cases