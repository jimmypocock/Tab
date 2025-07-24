# Corporate Features Migration Plan

## Overview
Migrating from separate corporate tables to a unified organizations model where features are unlocked based on organization capabilities.

## Implementation Strategy

### 1. Organization Types & Features
```typescript
// Organizations can have multiple capabilities
organization {
  is_merchant: true,     // Can accept payments
  is_corporate: true,    // Can make purchases across merchants
  // Future: is_platform, is_marketplace, etc.
}
```

### 2. API Authentication
- Use the consolidated `api_keys` table with `scope` field
- `scope: 'corporate'` - Access to corporate purchasing features
- `scope: 'merchant'` - Access to merchant features
- `scope: 'full'` - Access to both (for orgs that are both merchant and corporate)

### 3. B2B Relationships (organization_relationships)
Already exists in the schema! Use it for:
- Credit limits between organizations
- Payment terms (NET30, NET60, etc.)
- Discount percentages
- Auto-pay settings

### 4. Cross-Merchant Tab Creation
```typescript
// Tabs already support this with:
tabs {
  organization_id,           // The merchant receiving payment
  customer_organization_id,  // The corporate buyer
  paid_by_org_id,           // Who actually pays
  relationship_id,          // Links to terms/limits
}
```

### 5. Multi-User Management
Already handled by `organization_users` table with roles:
- `owner` - Full access
- `admin` - Can manage users and settings
- `member` - Can create tabs/purchases
- `viewer` - Read-only access

### 6. Activity Logging
Create a generic activity log table:
```sql
CREATE TABLE organization_activity (
  id uuid PRIMARY KEY,
  organization_id uuid REFERENCES organizations(id),
  user_id uuid REFERENCES users(id),
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamp DEFAULT NOW()
);
```

### 7. Feature Flags & Monetization
Add to organizations table:
```sql
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS
  features jsonb DEFAULT '{}';

-- Example features:
-- {
--   "cross_merchant_purchasing": true,
--   "spending_analytics": true,
--   "approval_workflows": true,
--   "max_users": 10,
--   "api_rate_limit": 1000
-- }
```

## Migration Path

1. **Update Corporate Middleware** to use unified API authentication
2. **Update Corporate Tab Routes** to use organization relationships
3. **Reimplement Corporate Service** using organizations model
4. **Update Dashboard UI** to show B2B relationships
5. **Add Activity Logging** as a generic service
6. **Implement Feature Flags** for monetization

## Benefits

1. **Single User Model** - Users can belong to multiple organizations with different roles
2. **Flexible Relationships** - Any org can have relationships with any other org
3. **Feature-Based Pricing** - Unlock features rather than having separate account types
4. **Simpler API** - One authentication system, one set of endpoints
5. **Better Scalability** - Easy to add new organization types or features