# Tab Application - Comprehensive QA Testing Guide

This guide provides a complete testing checklist for the Tab payment collection platform, covering all UI interactions, API endpoints, payment flows, and the new corporate accounts and professional invoicing features.

## Prerequisites

Before starting QA testing:

1. **Local Setup**

   ```bash
   # Ensure Supabase is running
   npm run supabase:start
   
   # Start the development server
   npm run dev
   
   # In a separate terminal, start Stripe webhook forwarding
   npm run stripe:listen
   ```

2. **Test Credentials**
   - Local API Keys:
     - `tab_test_12345678901234567890123456789012`
     - `tab_test_98765432109876543210987654321098`
   - Corporate API Keys (create via UI):
     - `corp_test_[generated]`
   - Stripe Test Cards:
     - Success: `4242 4242 4242 4242`
     - Decline: `4000 0000 0000 0002`
     - 3D Secure: `4000 0025 0000 3155`

3. **URLs**
   - Application: <http://localhost:1235>
   - Supabase Studio: <http://localhost:54323>
   - Email Testing: <http://localhost:54324>

---

## 1. Authentication & Registration Testing

### 1.1 Registration Flow

- [ ] Navigate to <http://localhost:1235/register>
- [ ] Test validation:
  - [ ] Submit empty form (should show errors)
  - [ ] Invalid email format
  - [ ] Password less than 6 characters
  - [ ] Missing business name
- [ ] Register with valid credentials:
  - [ ] Email: `qa_test_[timestamp]@example.com`
  - [ ] Password: `testpass123`
  - [ ] Business Name: `QA Test Business`
- [ ] Verify redirect to dashboard
- [ ] Check email inbox at <http://localhost:54324> for confirmation email

### 1.2 Login Flow

- [ ] Navigate to <http://localhost:1235/login>
- [ ] Test validation:
  - [ ] Empty credentials
  - [ ] Invalid email/password combination
- [ ] Login with registered credentials
- [ ] Verify "Remember me" functionality
- [ ] Test logout from dashboard
- [ ] Verify redirect to login after logout

---

## 2. Dashboard UI Testing

### 2.1 Main Dashboard

- [ ] Verify all stats cards load:
  - [ ] Total Revenue
  - [ ] Pending Revenue
  - [ ] Total Tabs
  - [ ] Open Tabs
- [ ] Check recent tabs table:
  - [ ] Displays customer information
  - [ ] Shows correct amounts and status
  - [ ] "View" links work

### 2.2 Tabs Management

- [ ] Navigate to /tabs
- [ ] Verify table displays all tabs
- [ ] Test sorting:
  - [ ] By date (newest/oldest)
  - [ ] By amount
  - [ ] By status
- [ ] Test filtering:
  - [ ] By status (open/paid/partial/cancelled)
  - [ ] By date range
- [ ] Click through to individual tab details

### 2.3 Tab Detail Page

- [ ] Navigate to specific tab (/tabs/[id])
- [ ] Verify all sections display:
  - [ ] Customer information
  - [ ] Line items with quantities and prices
  - [ ] Payment history
  - [ ] Tab summary with totals
- [ ] Test "Copy Payment Link" button
- [ ] Test "Send Invoice" button:
  - [ ] Opens invoice creation modal
  - [ ] Can select specific line items
  - [ ] Sets payment terms and due date

### 2.4 Invoices Page

- [ ] Navigate to /invoices
- [ ] Verify invoice list displays
- [ ] Check invoice statuses (draft/sent/viewed/partial/paid/void/uncollectible)
- [ ] Test creating invoice from tab:
  - [ ] Select tab to invoice
  - [ ] Choose line items to include
  - [ ] Set due date and payment terms
- [ ] Test sending an invoice:
  - [ ] Select recipients (can remove/add emails)
  - [ ] Send to multiple recipients (CC)
- [ ] Verify email received at <http://localhost:54324>
- [ ] Check invoice public URL works

### 2.5 Settings Page

- [ ] Navigate to /settings
- [ ] API Keys section:
  - [ ] Create new API key
  - [ ] Copy key (verify it's only shown once)
  - [ ] Delete API key
  - [ ] Verify deleted key no longer works
- [ ] View API documentation examples

### 2.6 Payment Processors (NEW)

- [ ] Navigate to /settings/processors
- [ ] Test adding Stripe processor:
  - [ ] Enter test API key
  - [ ] Select test mode
  - [ ] Save and verify connection
  - [ ] Check webhook auto-configuration
- [ ] Verify webhook status indicators
- [ ] Test deactivating/reactivating processor

### 2.7 Corporate Accounts (NEW)

- [ ] Navigate to /settings/corporate-accounts
- [ ] View list of corporate relationships
- [ ] Test adding corporate account:
  - [ ] Enter company details
  - [ ] Set credit limit and payment terms
  - [ ] Configure discount percentage
- [ ] Manage existing relationships:
  - [ ] Update credit limits
  - [ ] Change status (active/suspended)
  - [ ] View account activity

### 2.8 Team Management

- [ ] Navigate to /settings/team
- [ ] View current team members and their roles
- [ ] Test inviting new team member:
  - [ ] Enter email address
  - [ ] Select role (owner/admin/member/viewer)
  - [ ] Send invitation
  - [ ] Verify invitation email at http://localhost:54324
- [ ] Test invitation flow:
  - [ ] Click invitation link in email
  - [ ] Accept invitation and create account
  - [ ] Verify correct role assigned
  - [ ] Check access permissions match role
- [ ] Manage team members:
  - [ ] Update member roles
  - [ ] Remove team members
  - [ ] Verify removed members lose access

### 2.9 Organization Management

- [ ] Test organization switcher in dashboard header:
  - [ ] Click organization dropdown
  - [ ] View all available organizations
  - [ ] Switch between organizations
  - [ ] Verify data isolation between organizations
- [ ] Test organization setup (new users):
  - [ ] Navigate to /settings/setup-organization
  - [ ] Enter organization name
  - [ ] Verify slug auto-generation
  - [ ] Select organization type (merchant/corporate/both)
  - [ ] Complete setup
- [ ] Organization settings:
  - [ ] Update organization name
  - [ ] Change billing email
  - [ ] Configure time zone
  - [ ] Set default currency

### 2.10 B2B Relationships

- [ ] View organization relationships:
  - [ ] See connected organizations
  - [ ] Check credit limits and terms
  - [ ] View payment history
- [ ] Create B2B relationship:
  - [ ] Add trusted organization
  - [ ] Set credit limit
  - [ ] Configure payment terms (NET15/30/60)
  - [ ] Enable auto-pay options
- [ ] Test relationship limits:
  - [ ] Create tab exceeding credit limit (should fail)
  - [ ] Verify credit utilization tracking
  - [ ] Test suspended relationship access

---

## 3. API Testing with cURL

### 3.1 API Authentication Test

```bash
# Test with invalid API key
curl -X GET http://localhost:1235/api/v1/tabs \
  -H "X-API-Key: invalid_key_12345"
# Expected: 401 Unauthorized

# Test with valid API key
curl -X GET http://localhost:1235/api/v1/tabs \
  -H "X-API-Key: tab_test_12345678901234567890123456789012"
# Expected: 200 OK with tabs array
```

### 3.2 Create Tab with Line Items

```bash
# Create a new tab
curl -X POST http://localhost:1235/api/v1/tabs \
  -H "X-API-Key: tab_test_12345678901234567890123456789012" \
  -H "Content-Type: application/json" \
  -d '{
    "customerEmail": "qa_customer@example.com",
    "customerName": "QA Test Customer",
    "externalReference": "QA-TEST-001",
    "currency": "USD",
    "lineItems": [
      {
        "description": "Test Product 1",
        "quantity": 2,
        "unitPrice": 50.00
      },
      {
        "description": "Test Service",
        "quantity": 1,
        "unitPrice": 100.00
      }
    ],
    "taxRate": 0.08,
    "metadata": {
      "test_run": "qa_testing",
      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }
  }'
# Expected: 201 Created with tab object including payment_link
```

### 3.3 Professional Invoicing API (NEW)

```bash
# Create invoice from tab
curl -X POST http://localhost:1235/api/v1/tabs/TAB_ID/invoice \
  -H "X-API-Key: tab_test_12345678901234567890123456789012" \
  -H "Content-Type: application/json" \
  -d '{
    "lineItemIds": ["item1_id", "item2_id"],
    "dueDate": "2025-02-15",
    "paymentTerms": "NET30",
    "notes": "Thank you for your business"
  }'
# Expected: 201 Created with invoice object

# List invoices
curl -X GET http://localhost:1235/api/v1/invoices \
  -H "X-API-Key: tab_test_12345678901234567890123456789012"

# Get specific invoice
curl -X GET http://localhost:1235/api/v1/invoices/INVOICE_ID \
  -H "X-API-Key: tab_test_12345678901234567890123456789012"

# Send invoice via email
curl -X POST http://localhost:1235/api/v1/invoices/INVOICE_ID/send \
  -H "X-API-Key: tab_test_12345678901234567890123456789012" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientEmail": "customer@example.com",
    "ccEmails": ["accounting@example.com"]
  }'
```

### 3.4 Corporate Account API (NEW)

```bash
# Test corporate authentication
curl -X GET http://localhost:1235/api/v1/corporate/account \
  -H "X-Corporate-API-Key: corp_test_[your_key]"
# Expected: 200 OK with account details and merchant relationships

# Create tab as corporate account
curl -X POST http://localhost:1235/api/v1/corporate/tabs \
  -H "X-Corporate-API-Key: corp_test_[your_key]" \
  -H "Content-Type: application/json" \
  -d '{
    "merchant_id": "MERCHANT_UUID",
    "purchase_order_number": "PO-2025-001",
    "department": "Engineering",
    "cost_center": "CC-100",
    "line_items": [
      {
        "description": "Parts Order",
        "quantity": 10,
        "unit_price": 25.00
      }
    ]
  }'
# Expected: 201 Created with tab linked to corporate account

# List all tabs across merchants
curl -X GET http://localhost:1235/api/v1/corporate/tabs \
  -H "X-Corporate-API-Key: corp_test_[your_key]"

# Get spending report
curl -X GET "http://localhost:1235/api/v1/corporate/reports/spending?date_from=2025-01-01&date_to=2025-01-31" \
  -H "X-Corporate-API-Key: corp_test_[your_key]"
```

### 3.5 Organization Context API Testing

```bash
# Test API with organization context header
curl -X GET http://localhost:1235/api/v1/tabs \
  -H "X-API-Key: tab_test_12345678901234567890123456789012" \
  -H "X-Organization-Id: org_123"
# Expected: 200 OK with tabs for specified organization

# Test multi-organization access
# First, get list of available organizations
curl -X GET http://localhost:1235/api/v1/auth/organizations \
  -H "Authorization: Bearer [your_auth_token]"
# Expected: List of organizations user has access to

# Switch organization context
curl -X POST http://localhost:1235/api/v1/auth/switch-organization \
  -H "Authorization: Bearer [your_auth_token]" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "org_456"
  }'
# Expected: 200 OK with new context set
```

### 3.6 Team Invitation API

```bash
# Send team invitation
curl -X POST http://localhost:1235/api/v1/auth/invite \
  -H "Authorization: Bearer [your_auth_token]" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newteammember@example.com",
    "role": "member",
    "organizationId": "org_123"
  }'
# Expected: 201 Created with invitation details

# Accept invitation (requires invitation token from email)
curl -X POST http://localhost:1235/api/v1/auth/accept-invitation \
  -H "Content-Type: application/json" \
  -d '{
    "token": "invitation_token_from_email",
    "password": "newpassword123",
    "name": "New Team Member"
  }'
# Expected: 200 OK with user created and added to organization
```

### 3.7 Webhook Status API

```bash
# Check webhook status for processor
curl -X GET http://localhost:1235/api/v1/merchant/processors/[processor_id]/webhook-status \
  -H "X-API-Key: tab_test_12345678901234567890123456789012"
# Expected: 200 OK with webhook health status

# Manually trigger webhook verification
curl -X POST http://localhost:1235/api/v1/merchant/processors/[processor_id]/webhook-status/verify \
  -H "X-API-Key: tab_test_12345678901234567890123456789012"
# Expected: 200 OK with verification result
```

---

## 4. Payment Flow Testing

### 4.1 Customer Payment Page

1. **Access Payment Link**
   - [ ] Copy payment link from tab details or API response
   - [ ] Open in incognito/private browser window
   - [ ] Verify tab details display correctly:
     - [ ] Merchant business name
     - [ ] Line items with quantities and prices
     - [ ] Subtotal, tax, and total amounts
     - [ ] Any existing payments

2. **Payment Form Testing**
   - [ ] Test with success card: `4242 4242 4242 4242`
   - [ ] Enter any future expiry (e.g., 12/34)
   - [ ] Any 3-digit CVC
   - [ ] Any 5-digit ZIP
   - [ ] Submit payment
   - [ ] Verify success page displays
   - [ ] Check tab status updated to "paid" in dashboard

### 4.2 Invoice Payment Flow (NEW)

1. **Access Invoice Payment Page**
   - [ ] Navigate to invoice public URL (/pay/invoice/[public_url])
   - [ ] Verify invoice details display:
     - [ ] Invoice number and merchant info
     - [ ] Line items with individual amounts
     - [ ] Payment terms and due date
     - [ ] Total amount due

2. **Partial Invoice Payment**
   - [ ] Test paying partial amount
   - [ ] Verify payment allocation:
     - [ ] FIFO allocation (oldest items paid first)
     - [ ] Line items show allocated amounts
     - [ ] Invoice status updates to "partial"

3. **Payment Allocation Testing**
   - [ ] Create invoice with multiple line items
   - [ ] Make payment less than total
   - [ ] Verify in dashboard:
     - [ ] Payment allocations show per line item
     - [ ] Remaining amounts correct
     - [ ] Can complete payment for remaining balance

---

## 5. Business Use Case Testing (NEW)

### 5.1 Restaurant Bill Splitting

1. **Create Restaurant Tab**
   - [ ] Create tab with multiple food/beverage items
   - [ ] Include shared items (appetizers) and individual items

2. **Split Invoice Creation**
   - [ ] Create invoice for subset of items (Split 1)
   - [ ] Create second invoice for other items (Split 2)
   - [ ] Verify both invoices reference same tab
   - [ ] Each person can pay their invoice independently

### 5.2 Hotel Folio Management

1. **Create Hotel Tab**
   - [ ] Create tab with room charges
   - [ ] Add incidental charges (minibar, room service)
   - [ ] Add different service dates

2. **Folio Testing**
   - [ ] Create master folio invoice
   - [ ] Test direct billing to corporate account
   - [ ] Apply deposit to folio
   - [ ] Verify remaining balance calculation

### 5.3 Professional Services

1. **Create Project with Milestones**
   - [ ] Create tab for professional service
   - [ ] Define project milestones
   - [ ] Set milestone amounts or percentages

2. **Milestone Invoicing**
   - [ ] Create invoice for completed milestone
   - [ ] Verify milestone tracks invoice status
   - [ ] Test progress billing (percentage complete)

3. **Retainer Account Testing**
   - [ ] Create retainer account for client
   - [ ] Test depositing funds
   - [ ] Draw from retainer for invoice payment
   - [ ] Verify balance tracking
   - [ ] Test auto-replenishment rules

---

## 6. Edge Cases & Error Handling

### 6.1 Invoice Edge Cases (NEW)

- [ ] **Invoice Immutability** → Cannot edit sent invoices
- [ ] **Status Transitions** → Invalid transitions rejected
- [ ] **Version Control** → Amendments create new versions
- [ ] **Concurrent Payments** → Proper allocation handling
- [ ] **Over-payment** → Creates credit balance
- [ ] **Void Invoice** → Cannot accept payments

### 6.2 Corporate Account Edge Cases (NEW)

- [ ] **Credit Limits** → Cannot exceed when creating tabs
- [ ] **Inactive Relationships** → API calls rejected
- [ ] **Multiple Merchants** → Data properly isolated
- [ ] **Discount Application** → Correctly calculated

### 6.3 Payment Allocation Edge Cases (NEW)

- [ ] **FIFO Allocation** → Oldest items paid first
- [ ] **Proportional Split** → Correctly distributed
- [ ] **Manual Allocation** → Respects specified amounts
- [ ] **Refund Reversal** → Allocations properly reversed

### 6.4 Multi-Organization Edge Cases

- [ ] **Organization Switching** → Data properly isolated
- [ ] **Cross-Organization Access** → Cannot access other org data
- [ ] **Deleted Organization** → Graceful handling
- [ ] **Organization Limits** → Max organizations per user
- [ ] **Default Organization** → Proper fallback behavior

### 6.5 Team Management Edge Cases

- [ ] **Expired Invitations** → Cannot be accepted
- [ ] **Duplicate Invitations** → Properly handled
- [ ] **Role Downgrade** → Existing sessions updated
- [ ] **Owner Transfer** → At least one owner required
- [ ] **Invitation Resend** → Invalidates previous token

---

## 7. Security Testing

### 7.1 Payment Processor Security (NEW)

- [ ] **Credential Encryption** → Verify encrypted in database
- [ ] **API Key Masking** → Never exposed in responses
- [ ] **Webhook Verification** → Invalid signatures rejected
- [ ] **Test Mode Isolation** → Cannot process real payments

### 7.2 Corporate Account Security (NEW)

- [ ] **Account Isolation** → Cannot access other corp data
- [ ] **Merchant Relationships** → Only see authorized merchants
- [ ] **API Key Scoping** → Limited to corporate operations

### 7.3 Organization Security

- [ ] **Data Isolation** → Complete separation between orgs
- [ ] **API Key Binding** → Keys only work for their organization
- [ ] **Role Enforcement** → Permissions properly checked
- [ ] **Session Management** → Organization context maintained
- [ ] **Audit Logging** → Actions tracked per organization

### 7.4 Team Invitation Security

- [ ] **Token Security** → Cryptographically secure tokens
- [ ] **Expiration Enforcement** → Old tokens rejected
- [ ] **Email Verification** → Only invited email can accept
- [ ] **Role Validation** → Cannot assign higher than own role
- [ ] **Revocation** → Cancelled invitations blocked

---

## 8. Toast Notifications Testing (NEW)

- [ ] **Success Messages**:
  - [ ] Invoice sent successfully
  - [ ] Payment processed
  - [ ] Settings saved
- [ ] **Error Messages**:
  - [ ] API failures
  - [ ] Validation errors
  - [ ] Network issues
- [ ] **Toast Behavior**:
  - [ ] Auto-dismiss timing
  - [ ] Manual dismiss works
  - [ ] Multiple toasts stack properly

---

## 9. Database Migration Testing

Before testing new features, ensure migrations are applied:

```bash
# Apply migrations
npm run db:push:local

# Verify tables exist in Supabase Studio
# Check for:
# - invoices (enhanced)
# - invoice_line_items
# - payment_allocations
# - corporate_accounts
# - corporate_merchant_relationships
# - hotel_folios
# - project_milestones
# - retainer_accounts
```

---

## 10. Automated Jobs Testing

### 10.1 Cron Job Authentication

```bash
# Test cron job without auth (should fail)
curl -X POST http://localhost:1235/api/v1/cron/cleanup-invitations
# Expected: 401 Unauthorized

# Test with incorrect secret
curl -X POST http://localhost:1235/api/v1/cron/cleanup-invitations \
  -H "X-Cron-Secret: wrong_secret"
# Expected: 401 Unauthorized

# Test with correct secret (from CRON_SECRET env var)
curl -X POST http://localhost:1235/api/v1/cron/cleanup-invitations \
  -H "X-Cron-Secret: [your_cron_secret]"
# Expected: 200 OK with cleanup results
```

### 10.2 Scheduled Task Testing

- [ ] **Invitation Cleanup**:
  - [ ] Create expired invitation (>7 days old)
  - [ ] Run cleanup job
  - [ ] Verify invitation deleted
  - [ ] Check active invitations preserved
- [ ] **Future Jobs** (when implemented):
  - [ ] Payment reconciliation
  - [ ] Usage reports generation
  - [ ] Data archival

---

## 11. Performance Testing

### 11.1 Invoice Performance

- [ ] Create invoice with 100+ line items
- [ ] Test payment allocation performance
- [ ] Verify calculated fields update correctly
- [ ] Check invoice list pagination

### 11.2 Corporate Account Performance

- [ ] Create corporate account with 50+ merchant relationships
- [ ] List tabs across all merchants
- [ ] Generate spending reports for large date ranges

---

## Test Data Setup Script

Create comprehensive test data:

```bash
# Create test merchant and get API key
# Then run these commands to set up test scenarios

# 1. Restaurant scenario
curl -X POST http://localhost:1235/api/v1/tabs \
  -H "X-API-Key: [your_test_key]" \
  -H "Content-Type: application/json" \
  -d '{
    "customerEmail": "restaurant_table_5@example.com",
    "customerName": "Table 5",
    "lineItems": [
      {"description": "Shared Appetizer", "quantity": 1, "unitPrice": 15.00, "metadata": {"category": "appetizer", "split_group": "shared"}},
      {"description": "Steak - Seat 1", "quantity": 1, "unitPrice": 35.00, "metadata": {"category": "entree", "split_group": "seat_1"}},
      {"description": "Wine - Seat 1", "quantity": 2, "unitPrice": 12.00, "metadata": {"category": "beverage", "split_group": "seat_1"}},
      {"description": "Salmon - Seat 2", "quantity": 1, "unitPrice": 28.00, "metadata": {"category": "entree", "split_group": "seat_2"}},
      {"description": "Beer - Seat 2", "quantity": 1, "unitPrice": 8.00, "metadata": {"category": "beverage", "split_group": "seat_2"}}
    ]
  }'

# 2. Hotel scenario
curl -X POST http://localhost:1235/api/v1/tabs \
  -H "X-API-Key: [your_test_key]" \
  -H "Content-Type: application/json" \
  -d '{
    "customerEmail": "hotel_guest@example.com",
    "customerName": "John Smith - Room 412",
    "lineItems": [
      {"description": "Room Charge - Night 1", "quantity": 1, "unitPrice": 150.00, "metadata": {"category": "room", "service_date": "2025-01-20", "folio_category": "room_charge"}},
      {"description": "Room Charge - Night 2", "quantity": 1, "unitPrice": 150.00, "metadata": {"category": "room", "service_date": "2025-01-21", "folio_category": "room_charge"}},
      {"description": "Minibar", "quantity": 1, "unitPrice": 25.00, "metadata": {"category": "incidental", "folio_category": "incidental"}},
      {"description": "Room Service", "quantity": 1, "unitPrice": 45.00, "metadata": {"category": "incidental", "folio_category": "incidental"}},
      {"description": "City Tax", "quantity": 2, "unitPrice": 5.00, "metadata": {"category": "tax", "folio_category": "tax"}}
    ]
  }'

# 3. Professional services scenario
curl -X POST http://localhost:1235/api/v1/tabs \
  -H "X-API-Key: [your_test_key]" \
  -H "Content-Type: application/json" \
  -d '{
    "customerEmail": "client@company.com",
    "customerName": "ABC Corporation",
    "externalReference": "PROJECT-2025-001",
    "lineItems": [
      {"description": "Project Setup - Milestone 1", "quantity": 1, "unitPrice": 5000.00, "metadata": {"milestone": 1, "billing_type": "fixed_price"}},
      {"description": "Development Phase - Milestone 2", "quantity": 1, "unitPrice": 15000.00, "metadata": {"milestone": 2, "billing_type": "fixed_price"}},
      {"description": "Testing & Deployment - Milestone 3", "quantity": 1, "unitPrice": 10000.00, "metadata": {"milestone": 3, "billing_type": "fixed_price"}}
    ]
  }'
```

---

## Reporting Issues

When reporting issues, include:

1. **Steps to reproduce**
2. **Expected behavior**
3. **Actual behavior**
4. **Screenshots/recordings**
5. **Browser console errors**
6. **Network request/response data**
7. **Test data used**
8. **Feature area** (invoicing, corporate accounts, etc.)

---

## Automated Testing Commands

Run existing tests:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### 11.3 Multi-Organization Performance

- [ ] User with 10+ organizations
- [ ] Organization switching speed
- [ ] Context loading performance
- [ ] API response times with org context

---

## Summary of Updates

This comprehensive QA guide has been updated to include:

### New Features Added:
1. **Team Management** (Section 2.8) - Invitation system, role management
2. **Organization Management** (Section 2.9) - Multi-org support, switching, setup
3. **B2B Relationships** (Section 2.10) - Inter-organization connections
4. **Organization Context API** (Section 3.5) - API testing with org context
5. **Team Invitation API** (Section 3.6) - Invitation flow testing
6. **Webhook Status API** (Section 3.7) - Health monitoring
7. **Multi-Organization Edge Cases** (Section 6.4) - Edge case handling
8. **Team Management Edge Cases** (Section 6.5) - Invitation edge cases
9. **Organization Security** (Section 7.3) - Data isolation testing
10. **Team Invitation Security** (Section 7.4) - Token security
11. **Automated Jobs Testing** (Section 10) - Cron job testing
12. **Multi-Organization Performance** (Section 11.3) - Performance with multiple orgs

Work through each section systematically, paying special attention to:
- Organization context and data isolation
- Team invitation flows and role-based access
- Multi-merchant scenarios with corporate accounts
- Security boundaries between organizations

---