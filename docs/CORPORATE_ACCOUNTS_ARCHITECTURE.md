# Corporate Accounts Architecture

## Overview

Corporate accounts enable B2B customers to manage their relationships with multiple merchants through a unified system. Each corporate account can connect to multiple merchants while maintaining separate relationships and credit limits with each.

## Key Concepts

### 1. Corporate Account Structure
- **Corporate Account**: A business entity that can have relationships with multiple merchants
- **Account-Merchant Relationship**: Links a corporate account to a specific merchant with custom settings
- **Unified Access**: Single API key for accessing all merchant relationships
- **Tab Linking**: Tabs can be associated with corporate accounts for centralized management

### 2. Multi-Merchant Design
Each corporate account maintains separate:
- Credit limits per merchant
- Payment terms per merchant
- Billing addresses per merchant
- Contact persons per merchant
- Invoice consolidation preferences

## Database Schema

```sql
-- Corporate accounts table
CREATE TABLE corporate_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_number TEXT UNIQUE NOT NULL, -- e.g., "CORP-12345"
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
  key_prefix TEXT NOT NULL, -- e.g., "corp_live_" or "corp_test_"
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
  payment_terms TEXT, -- e.g., "NET30", "NET60", "PREPAID"
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  billing_contact_email TEXT,
  billing_contact_name TEXT,
  shipping_addresses JSONB DEFAULT '[]',
  custom_pricing JSONB, -- Product/service specific pricing
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
  permissions JSONB DEFAULT '{}', -- Granular permissions
  is_active BOOLEAN DEFAULT true,
  merchant_access JSONB DEFAULT '[]', -- Array of merchant IDs they can access
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced tabs table (add corporate account linking)
ALTER TABLE tabs ADD COLUMN corporate_account_id UUID REFERENCES corporate_accounts(id);
ALTER TABLE tabs ADD COLUMN corporate_relationship_id UUID REFERENCES corporate_merchant_relationships(id);
ALTER TABLE tabs ADD COLUMN purchase_order_number TEXT;
ALTER TABLE tabs ADD COLUMN department TEXT;
ALTER TABLE tabs ADD COLUMN cost_center TEXT;

-- Corporate account activity log
CREATE TABLE corporate_account_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  corporate_account_id UUID REFERENCES corporate_accounts(id) ON DELETE CASCADE,
  merchant_id UUID REFERENCES merchants(id),
  user_id UUID REFERENCES corporate_account_users(id),
  action TEXT NOT NULL, -- 'tab_created', 'invoice_viewed', 'payment_authorized', etc.
  entity_type TEXT, -- 'tab', 'invoice', 'payment'
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_corporate_accounts_number ON corporate_accounts(account_number);
CREATE INDEX idx_corporate_api_keys_prefix ON corporate_api_keys(key_prefix);
CREATE INDEX idx_corporate_api_keys_hash ON corporate_api_keys(key_hash);
CREATE INDEX idx_cmr_corporate_account ON corporate_merchant_relationships(corporate_account_id);
CREATE INDEX idx_cmr_merchant ON corporate_merchant_relationships(merchant_id);
CREATE INDEX idx_cmr_status ON corporate_merchant_relationships(status);
CREATE INDEX idx_tabs_corporate ON tabs(corporate_account_id);
CREATE INDEX idx_activity_corporate_account ON corporate_account_activity(corporate_account_id);
```

## API Design

### Corporate Account Authentication
```typescript
// Middleware to authenticate corporate API requests
export async function withCorporateAuth(req: Request) {
  const apiKey = req.headers.get('X-Corporate-API-Key')
  
  if (!apiKey) {
    throw new ApiError('Corporate API key required', 401)
  }
  
  const keyHash = await hashApiKey(apiKey)
  const corporateKey = await db.query.corporateApiKeys.findFirst({
    where: eq(corporateApiKeys.keyHash, keyHash),
    with: {
      corporateAccount: true
    }
  })
  
  if (!corporateKey || !corporateKey.isActive) {
    throw new ApiError('Invalid corporate API key', 401)
  }
  
  // Update last used
  await db.update(corporateApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(corporateApiKeys.id, corporateKey.id))
  
  return corporateKey.corporateAccount
}
```

### Corporate API Endpoints
```typescript
// Corporate account management
GET    /api/v1/corporate/account          // Get account details
PUT    /api/v1/corporate/account          // Update account info
GET    /api/v1/corporate/merchants        // List connected merchants
GET    /api/v1/corporate/users            // List authorized users
POST   /api/v1/corporate/users            // Add authorized user
DELETE /api/v1/corporate/users/:id        // Remove user

// Tab management across merchants
GET    /api/v1/corporate/tabs             // List all tabs across merchants
GET    /api/v1/corporate/tabs/:id         // Get specific tab
POST   /api/v1/corporate/tabs             // Create tab with merchant_id
GET    /api/v1/corporate/merchants/:id/tabs // Tabs for specific merchant

// Invoice and payment management
GET    /api/v1/corporate/invoices         // All invoices across merchants
GET    /api/v1/corporate/invoices/:id     // Specific invoice details
GET    /api/v1/corporate/payments         // Payment history
POST   /api/v1/corporate/payments         // Authorize payment

// Reporting and analytics
GET    /api/v1/corporate/reports/spending // Spending by merchant/period
GET    /api/v1/corporate/reports/invoices // Invoice summary
GET    /api/v1/corporate/activity         // Activity log
```

## Implementation Examples

### 1. Parts Supplier Use Case
```typescript
// Corporate account creates a tab with a specific merchant
const createCorporateTab = async (req: Request) => {
  const corporateAccount = await withCorporateAuth(req)
  const { merchant_id, line_items, purchase_order_number, department } = await req.json()
  
  // Verify relationship exists and is active
  const relationship = await db.query.corporateMerchantRelationships.findFirst({
    where: and(
      eq(corporateMerchantRelationships.corporateAccountId, corporateAccount.id),
      eq(corporateMerchantRelationships.merchantId, merchant_id),
      eq(corporateMerchantRelationships.status, 'active')
    )
  })
  
  if (!relationship) {
    throw new ApiError('No active relationship with this merchant', 403)
  }
  
  // Create tab linked to corporate account
  const tab = await db.insert(tabs).values({
    merchantId: merchant_id,
    corporateAccountId: corporateAccount.id,
    corporateRelationshipId: relationship.id,
    purchaseOrderNumber: purchase_order_number,
    department: department,
    customerEmail: relationship.billingContactEmail || corporateAccount.primaryContactEmail,
    customerName: corporateAccount.companyName,
    // ... other tab fields
  })
  
  // Log activity
  await db.insert(corporateAccountActivity).values({
    corporateAccountId: corporateAccount.id,
    merchantId: merchant_id,
    action: 'tab_created',
    entityType: 'tab',
    entityId: tab.id,
    metadata: { purchase_order_number, department }
  })
  
  return tab
}
```

### 2. Multi-Merchant Tab Listing
```typescript
// Get all tabs for a corporate account across all merchants
const listCorporateTabs = async (req: Request) => {
  const corporateAccount = await withCorporateAuth(req)
  const { merchant_id, status, date_from, date_to } = req.query
  
  let query = db.select({
    tab: tabs,
    merchant: merchants,
    relationship: corporateMerchantRelationships
  })
  .from(tabs)
  .innerJoin(merchants, eq(tabs.merchantId, merchants.id))
  .innerJoin(
    corporateMerchantRelationships,
    eq(tabs.corporateRelationshipId, corporateMerchantRelationships.id)
  )
  .where(eq(tabs.corporateAccountId, corporateAccount.id))
  
  // Apply filters
  if (merchant_id) {
    query = query.where(eq(tabs.merchantId, merchant_id))
  }
  if (status) {
    query = query.where(eq(tabs.status, status))
  }
  if (date_from) {
    query = query.where(gte(tabs.createdAt, new Date(date_from)))
  }
  if (date_to) {
    query = query.where(lte(tabs.createdAt, new Date(date_to)))
  }
  
  const results = await query.orderBy(desc(tabs.createdAt))
  
  // Group by merchant for easier consumption
  const groupedByMerchant = results.reduce((acc, { tab, merchant, relationship }) => {
    if (!acc[merchant.id]) {
      acc[merchant.id] = {
        merchant: {
          id: merchant.id,
          business_name: merchant.businessName,
          relationship: {
            credit_limit: relationship.creditLimit,
            payment_terms: relationship.paymentTerms,
            discount_percentage: relationship.discountPercentage
          }
        },
        tabs: []
      }
    }
    acc[merchant.id].tabs.push(tab)
    return acc
  }, {})
  
  return Object.values(groupedByMerchant)
}
```

### 3. Corporate Dashboard Component
```tsx
// Corporate account dashboard showing tabs across merchants
export function CorporateDashboard({ account }: { account: CorporateAccount }) {
  const [merchants, setMerchants] = useState<MerchantRelationship[]>([])
  const [selectedMerchant, setSelectedMerchant] = useState<string | null>(null)
  
  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Merchant selector */}
      <div className="col-span-3">
        <h3 className="text-lg font-medium mb-4">Your Merchants</h3>
        {merchants.map(merchant => (
          <div
            key={merchant.id}
            onClick={() => setSelectedMerchant(merchant.id)}
            className={`p-4 border rounded-lg mb-2 cursor-pointer ${
              selectedMerchant === merchant.id ? 'border-blue-500 bg-blue-50' : ''
            }`}
          >
            <h4 className="font-medium">{merchant.business_name}</h4>
            <p className="text-sm text-gray-600">
              Credit: ${merchant.credit_limit} | {merchant.payment_terms}
            </p>
            <p className="text-sm text-gray-600">
              Open tabs: {merchant.open_tabs_count}
            </p>
          </div>
        ))}
      </div>
      
      {/* Tab list for selected merchant */}
      <div className="col-span-9">
        {selectedMerchant ? (
          <TabsList 
            corporateAccountId={account.id}
            merchantId={selectedMerchant}
          />
        ) : (
          <AllMerchantTabs corporateAccountId={account.id} />
        )}
      </div>
    </div>
  )
}
```

## Security Considerations

### 1. Data Isolation
- Corporate accounts can only access tabs they created
- RLS policies ensure merchant data remains isolated
- Activity logging for audit trails

### 2. Permission Model
```typescript
// Example permission check
const canViewTab = async (
  corporateUser: CorporateAccountUser,
  tab: Tab
) => {
  // Admin can see all
  if (corporateUser.role === 'admin') return true
  
  // Check if user has access to this merchant
  if (!corporateUser.merchantAccess.includes(tab.merchantId)) {
    return false
  }
  
  // Check specific permissions
  return corporateUser.permissions.canViewTabs === true
}
```

### 3. API Rate Limiting
- Implement per-corporate-account rate limits
- Monitor for unusual activity patterns
- Alert on suspicious behavior

## Migration Strategy

### Phase 1: Schema Setup
1. Create corporate account tables
2. Add corporate fields to tabs table
3. Set up RLS policies

### Phase 2: API Implementation
1. Build corporate authentication middleware
2. Create corporate API endpoints
3. Add activity logging

### Phase 3: UI Development
1. Corporate account dashboard
2. Merchant relationship management
3. User management interface

### Phase 4: Integration
1. Update tab creation to support corporate accounts
2. Modify invoice generation for corporate billing
3. Add corporate reporting features

## Benefits

### For Merchants
- Streamlined B2B relationships
- Automated credit management
- Better customer insights
- Reduced manual account management

### For Corporate Customers
- Unified view across suppliers
- Simplified procurement process
- Better spend visibility
- Standardized payment terms

### For the Platform
- Higher transaction volumes
- Stickier customer relationships
- Enterprise market penetration
- Network effects between merchants