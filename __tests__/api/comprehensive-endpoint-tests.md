# Comprehensive Endpoint Testing Strategy

## Current Status
The codebase has existing test infrastructure that uses:
1. Mock database approach (not real database)
2. Test helpers for creating test data
3. Mock API key validation

## Key Issues with Current Tests
1. **Database Mocking**: Tests mock the `db` object but the mocking pattern doesn't match the actual Drizzle ORM query builder pattern
2. **Circular Dependencies**: Mocks are defined after imports, causing initialization errors
3. **Incomplete Coverage**: Many endpoints lack comprehensive test coverage

## Recommended Testing Approach

### 1. Fix Mock Initialization Order
```typescript
// At the top of test files, before any imports
jest.mock('@/lib/db/client')
jest.mock('@/lib/api/organization-middleware')
// ... other mocks

// Then import modules
import { GET, POST } from '@/app/api/v1/tabs/route'
```

### 2. Create Proper Database Mocks
```typescript
// Mock the query builder pattern correctly
const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  // ... other methods
  execute: jest.fn().mockResolvedValue([])
}
```

### 3. Test Categories for Each Endpoint

#### Authentication Tests
- Valid API key
- Missing API key
- Invalid API key
- Expired API key
- Wrong environment (test vs live)

#### Authorization Tests
- Organization access
- Role-based permissions
- Resource ownership

#### Validation Tests
- Required fields
- Field formats (email, phone, etc.)
- Business rules
- Edge cases (empty arrays, null values)

#### Success Path Tests
- Create operations
- Read operations (single and list)
- Update operations
- Delete operations
- Special operations (void, restore, etc.)

#### Error Handling Tests
- Database errors
- Network errors
- Concurrent modifications
- Invalid JSON
- Large payloads

#### Integration Tests
- Multi-step workflows
- Side effects (webhooks, emails)
- Transaction rollbacks

## Endpoints to Test

### Tabs (`/api/v1/tabs`)
- [x] GET /tabs - List tabs with pagination, filtering, sorting
- [x] POST /tabs - Create tab with line items
- [x] GET /tabs/[id] - Get single tab
- [x] PUT /tabs/[id] - Update tab
- [x] DELETE /tabs/[id] - Delete tab
- [x] POST /tabs/[id]/void - Void tab
- [x] PUT /tabs/[id]/void - Restore voided tab
- [x] GET /tabs/[id]/void - Get void history
- [x] POST /tabs/[id]/quick-split - Create quick split
- [x] POST /tabs/[id]/enable-billing-groups - Enable billing groups
- [x] GET /tabs/[id]/billing-summary - Get billing summary

### Line Items (`/api/v1/line-items`)
- [ ] GET /line-items - List line items
- [ ] POST /line-items - Create line item
- [ ] GET /line-items/[id] - Get single line item
- [ ] PUT /line-items/[id] - Update line item
- [ ] DELETE /line-items/[id] - Delete line item
- [ ] POST /line-items/[id]/assign - Assign to billing group
- [ ] POST /line-items/[id]/unassign - Unassign from billing group
- [ ] GET /line-items/[id]/protection-status - Get protection status
- [ ] POST /line-items/bulk-assign - Bulk assign
- [ ] POST /line-items/bulk-operations - Bulk operations

### Billing Groups (`/api/v1/billing-groups`)
- [ ] GET /billing-groups - List billing groups
- [ ] POST /billing-groups - Create billing group
- [ ] GET /billing-groups/[id] - Get single billing group
- [ ] PUT /billing-groups/[id] - Update billing group
- [ ] DELETE /billing-groups/[id] - Delete billing group
- [ ] GET /billing-groups/[id]/validate-deletion - Validate deletion
- [ ] POST /billing-groups/[id]/invoice - Create invoice
- [ ] GET /billing-groups/[id]/rules - Get rules
- [ ] POST /billing-groups/[id]/rules - Create rule
- [ ] PUT /billing-groups/[id]/rules/[ruleId] - Update rule
- [ ] DELETE /billing-groups/[id]/rules/[ruleId] - Delete rule

### Payments (`/api/v1/payments`)
- [ ] GET /payments - List payments
- [ ] POST /payments - Create payment (usually via webhook)

### Invoices (`/api/v1/invoices`)
- [ ] GET /invoices - List invoices
- [ ] POST /invoices/[id]/send - Send invoice

### API Keys (`/api/v1/organizations/[id]/api-keys`)
- [ ] GET /organizations/[id]/api-keys - List API keys
- [ ] POST /organizations/[id]/api-keys - Create API key
- [ ] PUT /organizations/[id]/api-keys/[keyId] - Update API key
- [ ] DELETE /organizations/[id]/api-keys/[keyId] - Revoke API key

### Organizations (`/api/v1/organizations`)
- [ ] GET /organizations/[id]/team - List team members
- [ ] POST /organizations/[id]/team/[userId] - Update member role
- [ ] DELETE /organizations/[id]/team/[userId] - Remove member
- [ ] GET /organizations/[id]/invitations - List invitations
- [ ] POST /organizations/[id]/invitations - Create invitation
- [ ] DELETE /organizations/[id]/invitations/[invitationId] - Cancel invitation
- [ ] POST /organizations/[id]/invitations/[invitationId]/resend - Resend invitation

### Public Endpoints
- [ ] GET /public/tabs/[id] - Get public tab
- [ ] POST /public/checkout-session - Create checkout session
- [ ] POST /public/invoice-payment - Process invoice payment
- [ ] GET /public/invoices/[publicUrl] - Get public invoice

### Webhooks
- [ ] POST /webhooks/stripe - Stripe webhook handler

## Test Execution Strategy

1. **Fix existing test infrastructure** - Update mocking patterns
2. **Create endpoint test templates** - Reusable test patterns
3. **Implement tests by priority**:
   - Critical payment flows
   - CRUD operations
   - Edge cases and error handling
4. **Run tests in CI/CD** - Ensure all tests pass before deployment

## Success Metrics
- Test coverage > 90%
- All critical paths tested
- No flaky tests
- Tests run in < 5 minutes
- Clear test failure messages