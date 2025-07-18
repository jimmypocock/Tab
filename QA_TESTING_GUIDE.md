# Tab Application - Comprehensive QA Testing Guide

This guide provides a complete testing checklist for the Tab payment collection platform, covering all UI interactions, API endpoints, and payment flows.

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
- [ ] Test "Send Invoice" functionality (if available)

### 2.4 Invoices Page

- [ ] Navigate to /invoices
- [ ] Verify invoice list displays
- [ ] Check invoice statuses (draft/sent/viewed/paid/overdue)
- [ ] Test sending an invoice
- [ ] Verify email received at <http://localhost:54324>

### 2.5 Settings Page

- [ ] Navigate to /settings
- [ ] API Keys section:
  - [ ] Create new API key
  - [ ] Copy key (verify it's only shown once)
  - [ ] Delete API key
  - [ ] Verify deleted key no longer works
- [ ] View API documentation examples

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

### 3.3 List Tabs with Filtering

```bash
# List all tabs
curl -X GET http://localhost:1235/api/v1/tabs \
  -H "X-API-Key: tab_test_12345678901234567890123456789012"

# Filter by status
curl -X GET "http://localhost:1235/api/v1/tabs?status=open" \
  -H "X-API-Key: tab_test_12345678901234567890123456789012"

# Filter by customer email
curl -X GET "http://localhost:1235/api/v1/tabs?customerEmail=qa_customer@example.com" \
  -H "X-API-Key: tab_test_12345678901234567890123456789012"

# Pagination
curl -X GET "http://localhost:1235/api/v1/tabs?limit=10&offset=0" \
  -H "X-API-Key: tab_test_12345678901234567890123456789012"

# Field selection
curl -X GET "http://localhost:1235/api/v1/tabs?fields=id,customerEmail,totalAmount,status" \
  -H "X-API-Key: tab_test_12345678901234567890123456789012"
```

### 3.4 Get Specific Tab

```bash
# Replace TAB_ID with actual ID from creation
curl -X GET http://localhost:1235/api/v1/tabs/TAB_ID \
  -H "X-API-Key: tab_test_12345678901234567890123456789012"

# With field selection
curl -X GET "http://localhost:1235/api/v1/tabs/TAB_ID?fields=id,lineItems,payments" \
  -H "X-API-Key: tab_test_12345678901234567890123456789012"
```

### 3.5 Update Tab

```bash
# Update customer information
curl -X PATCH http://localhost:1235/api/v1/tabs/TAB_ID \
  -H "X-API-Key: tab_test_12345678901234567890123456789012" \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Updated QA Customer",
    "metadata": {
      "updated": true,
      "update_timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }
  }'
```

### 3.6 Add Line Items to Existing Tab

```bash
# Add new line item
curl -X POST http://localhost:1235/api/v1/line-items \
  -H "X-API-Key: tab_test_12345678901234567890123456789012" \
  -H "Content-Type: application/json" \
  -d '{
    "tabId": "TAB_ID",
    "description": "Additional Item",
    "quantity": 1,
    "unitPrice": 25.00
  }'
```

### 3.7 List Payments

```bash
# List all payments
curl -X GET http://localhost:1235/api/v1/payments \
  -H "X-API-Key: tab_test_12345678901234567890123456789012"

# Filter by tab
curl -X GET "http://localhost:1235/api/v1/payments?tabId=TAB_ID" \
  -H "X-API-Key: tab_test_12345678901234567890123456789012"

# Filter by status
curl -X GET "http://localhost:1235/api/v1/payments?status=succeeded" \
  -H "X-API-Key: tab_test_12345678901234567890123456789012"
```

### 3.8 Delete Tab (only if no payments)

```bash
# Attempt to delete tab
curl -X DELETE http://localhost:1235/api/v1/tabs/TAB_ID \
  -H "X-API-Key: tab_test_12345678901234567890123456789012"
# Expected: 204 No Content (if no payments) or 400 Bad Request (if has payments)
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

3. **Failed Payment Testing**
   - [ ] Test with decline card: `4000 0000 0000 0002`
   - [ ] Verify error message displays
   - [ ] Confirm tab status remains "open"

4. **3D Secure Testing**
   - [ ] Test with 3DS card: `4000 0025 0000 3155`
   - [ ] Complete 3D Secure authentication
   - [ ] Verify payment processes successfully

### 4.2 Partial Payment Testing

1. **Create Tab via API** with high amount (e.g., $1000)
2. **Make Partial Payment**
   - [ ] Navigate to payment link
   - [ ] Pay less than full amount (e.g., $200)
   - [ ] Verify payment succeeds
   - [ ] Check tab status is "partial"
   - [ ] Verify remaining balance displays correctly

3. **Complete Payment**
   - [ ] Return to payment link
   - [ ] Pay remaining balance
   - [ ] Verify tab status updates to "paid"

### 4.3 Webhook Testing

1. **Ensure Stripe CLI is running**: `npm run stripe:listen`
2. **Monitor webhook events** in terminal
3. **Test webhook scenarios**:
   - [ ] Successful payment → `payment_intent.succeeded`
   - [ ] Failed payment → `payment_intent.payment_failed`
   - [ ] Verify database updates occur
   - [ ] Check payment records created/updated

---

## 5. Edge Cases & Error Handling

### 5.1 API Edge Cases

- [ ] **Empty request bodies** → Should return 400
- [ ] **Missing required fields** → Should return 400 with field errors
- [ ] **Invalid data types** → Should return 400
- [ ] **Non-existent resources** → Should return 404
- [ ] **Duplicate operations** → Should handle gracefully
- [ ] **Large payloads** → Test with 100+ line items
- [ ] **Special characters** in text fields
- [ ] **Maximum field lengths**
- [ ] **Negative amounts** → Should be rejected
- [ ] **Zero amounts** → Should be rejected

### 5.2 Payment Edge Cases

- [ ] **Expired payment links** → Should show appropriate message
- [ ] **Already paid tabs** → Should prevent double payment
- [ ] **Concurrent payments** → Only one should succeed
- [ ] **Network timeouts** → Should handle gracefully
- [ ] **Browser back button** during payment → Should not duplicate

### 5.3 Authentication Edge Cases

- [ ] **Expired sessions** → Should redirect to login
- [ ] **Invalid API keys** → Should return 401
- [ ] **Deleted API keys** → Should stop working immediately
- [ ] **Multiple browser sessions** → Should work independently

---

## 6. Performance Testing

### 6.1 Load Testing

```bash
# Create multiple tabs rapidly
for i in {1..50}; do
  curl -X POST http://localhost:1235/api/v1/tabs \
    -H "X-API-Key: tab_test_12345678901234567890123456789012" \
    -H "Content-Type: application/json" \
    -d '{
      "customerEmail": "load_test_'$i'@example.com",
      "customerName": "Load Test Customer '$i'",
      "currency": "USD",
      "lineItems": [
        {"description": "Item 1", "quantity": 1, "unitPrice": 10.00},
        {"description": "Item 2", "quantity": 2, "unitPrice": 20.00}
      ]
    }' &
done
wait
```

### 6.2 Response Time Checks

- [ ] Dashboard pages load < 2 seconds
- [ ] API responses return < 500ms
- [ ] Payment page loads < 3 seconds
- [ ] Search/filter operations < 1 second

---

## 7. Security Testing

### 7.1 Authorization Checks

- [ ] Cannot access other merchants' data via API
- [ ] Cannot access dashboard without authentication
- [ ] Cannot modify tabs after payment
- [ ] API keys are properly hashed in database
- [ ] Sensitive data not exposed in responses

### 7.2 Input Validation

- [ ] SQL injection attempts rejected
- [ ] XSS attempts sanitized
- [ ] CSRF protection active
- [ ] Rate limiting enforced

---

## 8. Email Testing

Check all emails at <http://localhost:54324>:

- [ ] **Registration confirmation** → Verify link works
- [ ] **Password reset** → Test full flow
- [ ] **Invoice emails** → Check formatting and links
- [ ] **Payment confirmations** → Verify amount and details

---

## 9. Mobile Responsiveness

Test on various viewport sizes:

- [ ] **Payment page** → Mobile-friendly
- [ ] **Dashboard** → Responsive tables
- [ ] **Forms** → Touch-friendly inputs
- [ ] **Navigation** → Mobile menu works

---

## 10. Browser Compatibility

Test core flows on:

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile browsers (iOS Safari, Chrome Android)

---

## Test Data Cleanup

After testing, clean up test data:

```bash
# Reset local database
npm run supabase:reset

# Or manually delete test records via Supabase Studio
# http://localhost:54323
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

---

This comprehensive QA guide covers all aspects of the Tab application. Work through each section systematically, checking off items as you complete them. Pay special attention to payment flows and webhook handling as these are critical to the application's functionality.
