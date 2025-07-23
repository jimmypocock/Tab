# Unified Organization Architecture

## Problem Statement

The current system has separate entities for Merchants (who create tabs) and Corporate Accounts (who pay tabs), but in reality, many businesses need to be both. This creates complexity and confusion.

## Solution: Single Organization Entity with Capabilities

### Core Concept

Replace separate "merchants" and "corporate_accounts" with a unified **Organizations** table. Organizations can have different **capabilities** enabled:

1. **Merchant Capability**: Can create tabs, receive payments, have payment processors
2. **Corporate Capability**: Can have credit accounts with other organizations, consolidated billing

### Database Schema

```sql
-- Core organization entity
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL DEFAULT 'business', -- business, individual, platform
  
  -- Capabilities (what this org can do)
  is_merchant BOOLEAN DEFAULT false,      -- Can create tabs/receive payments
  is_corporate BOOLEAN DEFAULT false,     -- Can have credit accounts with merchants
  
  -- Organization details
  legal_name TEXT,
  tax_id TEXT,
  website TEXT,
  logo_url TEXT,
  
  -- Contact info
  primary_email TEXT,
  billing_email TEXT,
  support_email TEXT,
  
  -- Address
  address JSONB,
  
  -- Settings and metadata
  settings JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- User relationships with organizations
CREATE TABLE organization_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  
  -- Context-specific permissions
  merchant_permissions JSONB DEFAULT '{}',    -- Only used if org is_merchant
  corporate_permissions JSONB DEFAULT '{}',   -- Only used if org is_corporate
  
  -- Relationship metadata
  department TEXT,
  title TEXT,
  invited_by UUID REFERENCES users(id),
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- Organization relationships (for B2B credit accounts)
CREATE TABLE organization_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- The merchant organization providing credit
  merchant_org_id UUID REFERENCES organizations(id),
  
  -- The corporate organization receiving credit  
  corporate_org_id UUID REFERENCES organizations(id),
  
  -- Relationship details
  credit_limit DECIMAL(12, 2),
  current_balance DECIMAL(12, 2) DEFAULT 0,
  payment_terms TEXT, -- NET30, NET60, etc
  discount_percentage DECIMAL(5, 2) DEFAULT 0,
  
  -- Status
  status TEXT DEFAULT 'active', -- active, suspended, closed
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  
  -- Auto-pay settings
  auto_pay_enabled BOOLEAN DEFAULT false,
  auto_pay_method_id UUID,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(merchant_org_id, corporate_org_id)
);

-- API Keys belong to organizations (for both merchant and corporate APIs)
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  
  -- Key details
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  name TEXT,
  
  -- Permissions/scope
  scope TEXT NOT NULL DEFAULT 'merchant', -- merchant, corporate, full
  permissions JSONB DEFAULT '{}',
  
  -- Usage tracking
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Tabs now reference organizations
ALTER TABLE tabs 
  DROP COLUMN merchant_id,
  DROP COLUMN corporate_account_id,
  ADD COLUMN organization_id UUID REFERENCES organizations(id),
  ADD COLUMN paid_by_org_id UUID REFERENCES organizations(id),
  ADD COLUMN relationship_id UUID REFERENCES organization_relationships(id);

-- Payment processors belong to merchant-enabled organizations
ALTER TABLE merchant_processors
  DROP COLUMN merchant_id,
  ADD COLUMN organization_id UUID REFERENCES organizations(id);
```

### Benefits of This Approach

1. **Flexibility**: Organizations can be merchants, corporate customers, or both
2. **Simplicity**: One user → organization relationship to manage
3. **Scalability**: Easy to add new organization types or capabilities
4. **Real-world alignment**: Matches how businesses actually operate

### Use Cases

#### Restaurant Chain Example
```
Organization: "Acme Restaurant Group"
- is_merchant: true (headquarters can create tabs)
- is_corporate: true (pays tabs at suppliers)

Users:
- John (owner): Full access to both merchant and corporate features
- Sarah (CFO): Admin access to corporate features, viewer for merchant
- Mike (GM): Member access to merchant features only

Relationships:
- Has credit account with "FoodCo Supplies" (merchant org)
- Has credit account with "Restaurant Equipment Inc" (merchant org)
- Provides credit to "BigCorp Catering" (corporate org)
```

#### Consultant Example
```
User: Jane (Consultant)

Organizations she belongs to:
1. "Jane's Consulting LLC" (her own company)
   - is_merchant: true
   - is_corporate: false
   - Role: owner

2. "Client A Corp"
   - is_merchant: true
   - is_corporate: true  
   - Role: admin (manages both their sales and purchases)

3. "Client B Inc"
   - is_merchant: true
   - is_corporate: false
   - Role: member (only manages their sales)
```

### Migration Strategy

1. Create new `organizations` table
2. Migrate data from `merchants` → `organizations` (with is_merchant = true)
3. Migrate data from `corporate_accounts` → `organizations` (with is_corporate = true)
4. Merge any duplicates (companies that are both)
5. Update all foreign keys
6. Drop old tables

### API Design

```typescript
// Single API for organization management
GET    /api/v1/organizations          // List user's organizations
POST   /api/v1/organizations          // Create new organization
GET    /api/v1/organizations/:id      // Get organization details
PUT    /api/v1/organizations/:id      // Update organization
DELETE /api/v1/organizations/:id      // Delete organization

// Capability-specific endpoints
GET    /api/v1/organizations/:id/merchant-settings    // If is_merchant
GET    /api/v1/organizations/:id/corporate-settings   // If is_corporate
GET    /api/v1/organizations/:id/relationships        // B2B relationships

// Context switching
POST   /api/v1/auth/switch-organization
POST   /api/v1/auth/switch-context     // merchant vs corporate view

// Unified tab creation (organization context determines behavior)
POST   /api/v1/tabs                    // Creates as merchant or corporate
```

### UI/UX Implications

1. **Single Organization Switcher**: Replace separate merchant/corporate switchers
2. **Context Modes**: Within an organization, switch between "Sales" (merchant) and "Purchases" (corporate) views
3. **Unified Team Management**: One place to manage all users and their permissions
4. **Smart Defaults**: System remembers last used context per organization

### Security Benefits

1. **Simpler RLS Policies**: One organization check instead of multiple
2. **Clearer Audit Trail**: All actions tied to organization + user
3. **Better Permission Model**: Permissions tied to organization capabilities

## Implementation Plan

### Phase 1: Database Schema (Week 1)
- Create new tables
- Write migration scripts
- Update Drizzle schema

### Phase 2: Service Layer (Week 2)
- Create OrganizationService
- Update UserService for new relationships
- Migrate existing services

### Phase 3: API Updates (Week 3)
- New organization endpoints
- Update existing endpoints
- Backward compatibility layer

### Phase 4: UI Migration (Week 4)
- Organization switcher component
- Context switching UI
- Update all pages

### Phase 5: Data Migration (Week 5)
- Test migrations thoroughly
- Run on staging
- Production migration

## Decision Record

**Option 1**: Keep separate merchants and corporate accounts
- Pros: No migration needed, conceptually simple
- Cons: Complex relationships, duplicate data, confusing UX

**Option 2**: Unified organizations with capabilities ✅
- Pros: Flexible, scalable, matches reality, simpler UX
- Cons: Requires migration, initial development effort

**Option 3**: Make everything a "merchant" with types
- Pros: Simpler than option 1
- Cons: Naming confusion, still not flexible enough

**Recommendation**: Option 2 - Unified organizations with capabilities. While it requires upfront work, it provides the cleanest, most maintainable solution that matches real-world business needs.