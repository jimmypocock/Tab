# Tab API Documentation

## Overview

The Tab API is a RESTful API that allows you to create and manage payment tabs, process payments, and handle invoices. All API requests must be authenticated using an API key.

## Base URL

```
https://yourdomain.com/api/v1
```

For local development:
```
http://localhost:1235/api/v1
```

## Authentication

All API requests require authentication using an API key in the header:

```
X-API-Key: tab_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

For local development, use these test API keys:
- `tab_test_12345678901234567890123456789012`
- `tab_test_98765432109876543210987654321098`

## Response Format

All responses are returned in JSON format with appropriate HTTP status codes.

### Success Response
```json
{
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-16T12:00:00Z"
  }
}
```

### Error Response
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": { ... }
  }
}
```

## Endpoints

### Tabs

#### Create a Tab

Create a new payment tab with line items.

**Endpoint:** `POST /tabs`

**Request Body:**
```json
{
  "customer_email": "customer@example.com",
  "customer_name": "John Doe",
  "external_reference": "ORDER-123",
  "line_items": [
    {
      "description": "Product A",
      "quantity": 2,
      "unit_price": 25.00
    },
    {
      "description": "Service B",
      "quantity": 1,
      "unit_price": 50.00
    }
  ],
  "tax_rate": 0.08,
  "currency": "USD",
  "metadata": {
    "order_id": "12345",
    "custom_field": "value"
  }
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:1235/api/v1/tabs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tab_test_12345678901234567890123456789012" \
  -d '{
    "customer_email": "customer@example.com",
    "customer_name": "John Doe",
    "line_items": [
      {
        "description": "Consulting Service",
        "quantity": 2,
        "unit_price": 150.00
      }
    ],
    "tax_rate": 0.08
  }'
```

**Response:**
```json
{
  "data": {
    "id": "tab_1234567890",
    "merchant_id": "550e8400-e29b-41d4-a716-446655440001",
    "customer_email": "customer@example.com",
    "customer_name": "John Doe",
    "status": "open",
    "currency": "USD",
    "subtotal": "300.00",
    "tax_amount": "24.00",
    "total_amount": "324.00",
    "paid_amount": "0.00",
    "payment_link": "http://localhost:1235/pay/tab_1234567890",
    "created_at": "2024-01-16T12:00:00Z",
    "updated_at": "2024-01-16T12:00:00Z",
    "line_items": [
      {
        "id": "li_1234567890",
        "description": "Consulting Service",
        "quantity": 2,
        "unit_price": "150.00",
        "total": "300.00"
      }
    ]
  }
}
```

#### List Tabs

Retrieve a list of tabs with optional filtering.

**Endpoint:** `GET /tabs`

**Query Parameters:**
- `status` (optional): Filter by status (open, partial, paid, void)
- `customer_email` (optional): Filter by customer email
- `created_after` (optional): Filter by creation date (ISO 8601)
- `created_before` (optional): Filter by creation date (ISO 8601)
- `limit` (optional): Number of results per page (default: 50, max: 100)
- `offset` (optional): Number of results to skip
- `fields` (optional): Comma-separated list of fields to include

**cURL Example:**
```bash
# Get all open tabs
curl -X GET "http://localhost:1235/api/v1/tabs?status=open" \
  -H "X-API-Key: tab_test_12345678901234567890123456789012"

# Get tabs with specific fields
curl -X GET "http://localhost:1235/api/v1/tabs?fields=id,customer_email,total_amount,status" \
  -H "X-API-Key: tab_test_12345678901234567890123456789012"

# Get tabs created in the last 7 days
curl -X GET "http://localhost:1235/api/v1/tabs?created_after=2024-01-09T00:00:00Z" \
  -H "X-API-Key: tab_test_12345678901234567890123456789012"
```

#### Get a Tab

Retrieve details of a specific tab.

**Endpoint:** `GET /tabs/{id}`

**cURL Example:**
```bash
curl -X GET http://localhost:1235/api/v1/tabs/tab_1234567890 \
  -H "X-API-Key: tab_test_12345678901234567890123456789012"
```

#### Update a Tab

Update tab details (only for open tabs).

**Endpoint:** `PATCH /tabs/{id}`

**Request Body:**
```json
{
  "customer_name": "John Smith",
  "external_reference": "ORDER-456",
  "metadata": {
    "notes": "Updated customer name"
  }
}
```

**cURL Example:**
```bash
curl -X PATCH http://localhost:1235/api/v1/tabs/tab_1234567890 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tab_test_12345678901234567890123456789012" \
  -d '{
    "customer_name": "John Smith",
    "metadata": {
      "notes": "VIP customer"
    }
  }'
```

#### Void a Tab

Void an open tab (cancels it).

**Endpoint:** `POST /tabs/{id}/void`

**cURL Example:**
```bash
curl -X POST http://localhost:1235/api/v1/tabs/tab_1234567890/void \
  -H "X-API-Key: tab_test_12345678901234567890123456789012"
```

### Line Items

#### Add Line Items

Add line items to an existing open tab.

**Endpoint:** `POST /line-items`

**Request Body:**
```json
{
  "tab_id": "tab_1234567890",
  "items": [
    {
      "description": "Additional Service",
      "quantity": 1,
      "unit_price": 75.00,
      "metadata": {
        "sku": "SVC-001"
      }
    }
  ]
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:1235/api/v1/line-items \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tab_test_12345678901234567890123456789012" \
  -d '{
    "tab_id": "tab_1234567890",
    "items": [
      {
        "description": "Rush Delivery Fee",
        "quantity": 1,
        "unit_price": 25.00
      }
    ]
  }'
```

### Payments

#### Create Payment Intent

Create a Stripe payment intent for a tab (used by the payment page).

**Endpoint:** `POST /public/payment-intent`

**Request Body:**
```json
{
  "tab_id": "tab_1234567890",
  "amount": 324.00
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:1235/api/v1/public/payment-intent \
  -H "Content-Type: application/json" \
  -d '{
    "tab_id": "tab_1234567890",
    "amount": 324.00
  }'
```

**Response:**
```json
{
  "data": {
    "client_secret": "pi_1234567890_secret_abcdef",
    "amount": 324.00,
    "currency": "USD"
  }
}
```

#### List Payments

Get all payments for your account or filter by tab.

**Endpoint:** `GET /payments`

**Query Parameters:**
- `tab_id` (optional): Filter payments by tab
- `status` (optional): Filter by payment status
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset

**cURL Example:**
```bash
# Get all payments
curl -X GET http://localhost:1235/api/v1/payments \
  -H "X-API-Key: tab_test_12345678901234567890123456789012"

# Get payments for a specific tab
curl -X GET "http://localhost:1235/api/v1/payments?tab_id=tab_1234567890" \
  -H "X-API-Key: tab_test_12345678901234567890123456789012"
```

### Webhooks

#### Stripe Webhook

Handle Stripe webhook events for payment processing.

**Endpoint:** `POST /webhooks/stripe`

**Headers Required:**
- `stripe-signature`: Stripe webhook signature

**Note:** This endpoint is called by Stripe, not directly by your application.

**Local Testing with Stripe CLI:**
```bash
# Forward Stripe webhooks to your local server
stripe listen --forward-to localhost:1235/api/v1/webhooks/stripe

# Trigger test events
stripe trigger payment_intent.succeeded
```

### Public Endpoints

#### Get Public Tab Details

Retrieve tab details for the payment page (no authentication required).

**Endpoint:** `GET /public/tabs/{id}`

**cURL Example:**
```bash
curl -X GET http://localhost:1235/api/v1/public/tabs/tab_1234567890
```

**Response:**
```json
{
  "data": {
    "id": "tab_1234567890",
    "customer_email": "customer@example.com",
    "customer_name": "John Doe",
    "status": "open",
    "currency": "USD",
    "subtotal": "300.00",
    "tax_amount": "24.00",
    "total_amount": "324.00",
    "paid_amount": "0.00",
    "line_items": [
      {
        "description": "Consulting Service",
        "quantity": 2,
        "unit_price": "150.00",
        "total": "300.00"
      }
    ],
    "merchant": {
      "business_name": "Test Business Inc"
    }
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Missing or invalid API key |
| `FORBIDDEN` | Access denied to resource |
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Invalid request parameters |
| `INVALID_TAB_STATUS` | Operation not allowed for tab status |
| `PAYMENT_FAILED` | Payment processing failed |
| `RATE_LIMIT_EXCEEDED` | Too many requests |

## Rate Limiting

API requests are rate limited to:
- 100 requests per minute for test mode
- 1000 requests per minute for live mode

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp

## Testing

### Quick Test Flow

1. **Create a tab:**
```bash
TAB_ID=$(curl -s -X POST http://localhost:1235/api/v1/tabs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tab_test_12345678901234567890123456789012" \
  -d '{
    "customer_email": "test@example.com",
    "customer_name": "Test User",
    "line_items": [
      {"description": "Test Item", "quantity": 1, "unit_price": 100.00}
    ],
    "tax_rate": 0.08
  }' | jq -r '.data.id')

echo "Created tab: $TAB_ID"
```

2. **Get the payment link:**
```bash
curl -s -X GET http://localhost:1235/api/v1/tabs/$TAB_ID \
  -H "X-API-Key: tab_test_12345678901234567890123456789012" \
  | jq '.data.payment_link'
```

3. **Add more items:**
```bash
curl -X POST http://localhost:1235/api/v1/line-items \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tab_test_12345678901234567890123456789012" \
  -d "{
    \"tab_id\": \"$TAB_ID\",
    \"items\": [
      {\"description\": \"Additional Item\", \"quantity\": 1, \"unit_price\": 50.00}
    ]
  }"
```

4. **Check tab status:**
```bash
curl -X GET http://localhost:1235/api/v1/tabs/$TAB_ID \
  -H "X-API-Key: tab_test_12345678901234567890123456789012" \
  | jq '.data | {id, status, total_amount, paid_amount}'
```

## SDKs and Libraries

Currently, the Tab API can be accessed using standard HTTP libraries. Official SDKs are planned for:
- Node.js/TypeScript
- Python
- Ruby
- PHP
- Go

## Support

For API support, please contact:
- Email: api-support@yourdomain.com
- Documentation: https://docs.yourdomain.com
- Status Page: https://status.yourdomain.com