# Tab - Simple Payment Collection API

Tab is an easy-to-use API that allows businesses to create tabs, send invoices, and collect payments from customers.

## Features

- **API-First Design**: RESTful API for creating and managing payment tabs
- **Dashboard**: Web interface for merchants to manage tabs and payments
- **Secure Payments**: Stripe integration for secure payment processing
- **Multi-tenant**: Each merchant has isolated data and API keys
- **Real-time Updates**: Webhook support for payment status updates

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

4. **Set up Supabase**
   
   a. Create a new Supabase project
   
   b. Run the database migrations:
   ```bash
   npm run db:push
   ```
   
   c. Enable Row Level Security (RLS) on all tables
   
   d. Add RLS policies (see `supabase/policies.sql` below)

5. **Set up Stripe webhook (for local testing)**
   ```bash
   stripe listen --forward-to localhost:1235/api/v1/webhooks/stripe
   ```
   
   Copy the webhook signing secret to your `.env.local`

6. **Run the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:1235](http://localhost:1235)

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
- `/lib` - Shared utilities and configurations
  - `/db` - Database schema and client
  - `/api` - API middleware and validation
  - `/supabase` - Supabase clients
  - `/stripe` - Stripe configuration
- `/components` - React components
- `/types` - TypeScript type definitions

## Security Considerations

- API keys are hashed before storage
- Stripe handles all payment information (PCI compliance)
- Row Level Security ensures data isolation
- All endpoints validate merchant ownership
- HTTPS required in production

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details