# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tab is a payment collection API platform built with Next.js 14, allowing businesses to create tabs, send invoices, and collect payments. It uses Supabase for database/auth, Stripe for payments, and is designed for Vercel deployment.

## Essential Commands

```bash
# Development
npm run dev              # Start dev server on localhost:1235
npm run build            # Build for production
npm run lint             # Run ESLint

# Local Development Setup
npm run setup:local      # Set up local Supabase environment
npm run supabase:start   # Start local Supabase
npm run supabase:stop    # Stop local Supabase
npm run supabase:reset   # Reset local database

# Database
npm run db:push          # Push schema changes to Supabase
npm run db:push:local    # Push schema to local Supabase
npm run db:generate      # Generate Drizzle migrations

# Stripe (for local development)
npm run stripe:listen    # Forward webhooks to localhost

# Testing
npm test                 # Run all tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage report
```

## Local Development

For local development with Supabase:

1. **Quick Setup**: Run `npm run setup:local` to automatically set up local Supabase
2. **Manual Setup**: See `/docs/LOCAL_DEVELOPMENT.md` for detailed instructions
3. **Test API Keys**: Use `tab_test_12345678901234567890123456789012` for local testing
4. **Local URLs**:
   - Supabase Studio: http://localhost:54323
   - Email Testing: http://localhost:54324
   - API: http://localhost:54321

## Architecture Overview

### API Structure
- **REST API** at `/api/v1/*` with endpoints for tabs, payments, line items, and webhooks
- **Authentication** via API keys (header: `X-API-Key: tab_live_xxx`)
- **Validation** using Zod schemas in `/lib/api/validation.ts`

### Database Schema (Drizzle ORM)
- **merchants** - Business accounts (linked to Supabase auth users)
- **api_keys** - Hashed API keys for merchants
- **tabs** - Payment tabs with customer info and totals
- **line_items** - Individual items on tabs
- **payments** - Payment records linked to Stripe
- **invoices** - Invoice records for tabs

All tables use Row Level Security (RLS) for data isolation.

### Key Architectural Patterns

1. **Multi-tenant Isolation**: Each merchant's data is isolated via RLS policies based on `auth.uid()`

2. **API Middleware Stack** (`/lib/api/middleware.ts`):
   - CORS handling
   - API key validation
   - Merchant context injection
   - Error handling

3. **Payment Flow**:
   - Create tab with line items → Generate payment link → Process via Stripe → Update via webhook

4. **Authentication Flow**:
   - Dashboard uses Supabase Auth (cookie-based)
   - API uses merchant API keys
   - Middleware protects dashboard routes

### Directory Structure

```
/app
  /(auth)          # Public auth pages
  /(dashboard)     # Protected merchant dashboard
  /api/v1          # REST API endpoints
  /pay             # Public payment pages
/components
  /dashboard       # Dashboard-specific components
  /ui              # Reusable UI components
/lib
  /db              # Database schema and client
  /api             # API utilities and middleware
  /stripe          # Stripe integration
  /supabase        # Supabase clients
```

## Development Guidelines

### When Adding API Endpoints
1. Add route in `/app/api/v1/`
2. Use `withApiAuth` middleware for authentication
3. Validate with Zod schemas
4. Return consistent error responses

### When Modifying Database
1. Update schema in `/lib/db/schema.ts`
2. Run `npm run db:push` to apply changes
3. Update RLS policies if needed

### When Working with Payments
1. All payment processing through Stripe
2. Listen for webhooks in development: `npm run stripe:listen`
3. Update payment status only via webhook handlers

### Environment Variables
Required for local development:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL`