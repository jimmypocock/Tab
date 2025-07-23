# Tab - Simple Payment Collection API

Tab is an easy-to-use API that allows businesses to create tabs, send invoices, and collect payments from customers.

## Features

- **API-First Design**: RESTful API for creating and managing payment tabs
- **Dashboard**: Web interface for merchants to manage tabs and payments
- **Secure Payments**: Multiple payment processor support with bank-level encryption
- **Multi-tenant**: Each merchant has isolated data and API keys
- **Real-time Updates**: Automatic webhook configuration for payment status updates
- **Payment Processors**: Currently supports Stripe (Square, PayPal, Authorize.Net coming soon)
- **Security**: AES-256-GCM encryption for payment credentials

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase (PostgreSQL)
- **ORM**: Drizzle ORM
- **Authentication**: Supabase Auth
- **Payments**: Stripe
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Stripe account
- Vercel account (for deployment)

## Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/tab-app.git
   cd tab-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Fill in your environment variables:
   - Supabase URL and keys from your Supabase project
   - Stripe keys from your Stripe dashboard
   - Set `NEXT_PUBLIC_APP_URL` to `http://localhost:1235` for local development

4. **Generate encryption key for payment credentials**
   ```bash
   node scripts/generate-encryption-key.js
   ```
   
   Add the generated key to your `.env.local`:
   ```
   PAYMENT_PROCESSOR_ENCRYPTION_KEY=your-generated-key-here
   ```

5. **Set up Supabase**
   
   **Option A: Local Supabase (Recommended for Development)**
   ```bash
   # Quick setup - automatically starts local Supabase
   npm run setup:local
   
   # Or manually:
   npm run supabase:start
   npm run db:push:local
   ```
   
   Local Supabase URLs:
   - Studio: http://localhost:54323
   - API: http://localhost:54321
   
   **Option B: Cloud Supabase**
   - Create a new Supabase project
   - Run migrations: `npm run db:push`
   - Add RLS policies (see below)

6. **Webhook Setup for Local Development**
   
   The app automatically configures webhooks when you add a payment processor, but this requires a publicly accessible URL. For local development, you have two options:
   
   **Option A: Stripe CLI (Manual Webhooks)**
   ```bash
   npm run stripe:listen
   # or manually:
   stripe listen --forward-to localhost:1235/api/v1/webhooks/stripe
   ```
   
   Copy the webhook signing secret to your `.env.local` if needed.
   
   **Option B: ngrok (Automatic Webhook Configuration)**
   ```bash
   # Install ngrok if you haven't already
   ngrok http 1235
   ```
   
   Then update your `.env.local` with the ngrok URL:
   ```
   NEXT_PUBLIC_APP_URL=https://your-subdomain.ngrok-free.app
   ```
   
   With this setup, webhooks will be automatically configured in Stripe when you add it as a payment processor through the dashboard.

7. **Run the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:1235](http://localhost:1235)

8. **Test API Keys for Development**
   
   For local testing without setting up payment processors:
   ```
   tab_test_12345678901234567890123456789012
   ```

## Deployment to Vercel

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Add environment variables from `.env.local`
   - Update `NEXT_PUBLIC_APP_URL` to your Vercel URL
   - Deploy!

3. **Configure Stripe Webhooks**
   - In Stripe Dashboard, add a webhook endpoint: `https://your-app.vercel.app/api/v1/webhooks/stripe`
   - Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created`
   - Copy the signing secret to Vercel environment variables

## Supabase Setup

### Database Schema

The schema is automatically created when you run `npm run db:push`. 

### Required RLS Policies

Create a file `supabase/policies.sql`:

```sql
-- Enable RLS on all tables
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_processors ENABLE ROW LEVEL SECURITY;

-- Merchants policies
CREATE POLICY "Merchants can view own record" ON merchants
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Merchants can update own record" ON merchants
  FOR UPDATE USING (auth.uid() = id);

-- API Keys policies
CREATE POLICY "Merchants can manage own API keys" ON api_keys
  FOR ALL USING (auth.uid() = merchant_id);

-- Tabs policies
CREATE POLICY "Merchants can manage own tabs" ON tabs
  FOR ALL USING (auth.uid() = merchant_id);

-- Line Items policies (through tabs)
CREATE POLICY "Merchants can manage line items for own tabs" ON line_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tabs 
      WHERE tabs.id = line_items.tab_id 
      AND tabs.merchant_id = auth.uid()
    )
  );

-- Payments policies (through tabs)
CREATE POLICY "Merchants can view payments for own tabs" ON payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tabs 
      WHERE tabs.id = payments.tab_id 
      AND tabs.merchant_id = auth.uid()
    )
  );

-- Invoices policies (through tabs)
CREATE POLICY "Merchants can manage invoices for own tabs" ON invoices
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tabs 
      WHERE tabs.id = invoices.tab_id 
      AND tabs.merchant_id = auth.uid()
    )
  );

-- Merchant Processors policies
CREATE POLICY "Merchants can manage own payment processors" ON merchant_processors
  FOR ALL USING (auth.uid() = merchant_id);
```

Run these policies in the Supabase SQL editor.

## API Usage

### Authentication

Include your API key in the `X-API-Key` header:

```bash
X-API-Key: tab_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Create a Tab

```bash
POST /api/v1/tabs
Content-Type: application/json

{
  "customerEmail": "customer@example.com",
  "customerName": "John Doe",
  "lineItems": [
    {
      "description": "Product Name",
      "quantity": 1,
      "unitPrice": 29.99
    }
  ]
}
```

### Get Tab Details

```bash
GET /api/v1/tabs/{tab_id}
```

### Create Payment

```bash
POST /api/v1/payments
Content-Type: application/json

{
  "tabId": "uuid-here",
  "amount": 29.99,
  "paymentMethodId": "pm_xxxxx"
}
```

## Project Structure

- `/app` - Next.js app router pages and API routes
  - `/(auth)` - Public authentication pages
  - `/(dashboard)` - Protected merchant dashboard
  - `/api/v1` - REST API endpoints
  - `/pay` - Public payment pages
- `/lib` - Shared utilities and configurations
  - `/db` - Database schema and client (Drizzle ORM)
  - `/api` - API middleware and validation
  - `/supabase` - Supabase clients
  - `/payment-processors` - Payment processor integrations
  - `/services` - Business logic services
- `/components` - React components
  - `/dashboard` - Dashboard-specific components
  - `/ui` - Reusable UI components
- `/scripts` - Utility scripts
- `/supabase` - Supabase configuration and migrations

## Security Considerations

- API keys are hashed using bcrypt before storage
- Payment processor credentials are encrypted with AES-256-GCM
- Stripe handles all payment information (PCI compliance)
- Row Level Security ensures data isolation between merchants
- All endpoints validate merchant ownership
- HTTPS required in production
- Automatic webhook signature verification
- Environment-based security policies

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details