# Production Deployment Guide

This guide covers deploying Tab to production with proper security settings.

## Pre-Deployment Checklist

### 1. Database Security (Critical)

**Row Level Security (RLS) is MANDATORY for production**. The application uses RLS to ensure merchants can only access their own data.

#### Verify RLS is Enabled

```sql
-- Check RLS status on all tables
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('merchants', 'api_keys', 'tabs', 'line_items', 'payments', 'invoices');
```

All tables should show `rowsecurity = true`. If not, the migration didn't run properly.

#### Apply Migrations

When deploying to a new Supabase project:

```bash
# Push all migrations to production
npx supabase db push --linked

# Or manually apply the initial schema
psql $DATABASE_URL < supabase/migrations/20240318_initial_schema.sql
```

### 2. Environment Variables

Required for production:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=your-database-url

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# App
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NODE_ENV=production

# Optional: Rate limiting
UPSTASH_REDIS_REST_URL=your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

### 3. Stripe Webhook Configuration

1. In Stripe Dashboard, create a webhook endpoint:
   - URL: `https://yourdomain.com/api/v1/webhooks/stripe`
   - Events to listen for:
     - `checkout.session.completed`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `charge.dispute.created`
     - `charge.refunded`

2. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### 4. Deployment Steps

#### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

#### Manual Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Set all environment variables on your hosting platform

3. Ensure your platform supports Node.js 18+

### 5. Post-Deployment Verification

1. **Test RLS Policies**:
   - Create two merchant accounts
   - Create tabs with each account
   - Verify merchants can only see their own tabs

2. **Test Payment Flow**:
   - Create a test tab
   - Complete a payment
   - Verify webhook processing

3. **Monitor Logs**:
   - Check application logs for errors
   - Monitor Stripe webhook events

## Security Best Practices

1. **Never disable RLS** on any table
2. **Rotate API keys** regularly
3. **Use environment variables** for all secrets
4. **Enable CORS** only for trusted domains
5. **Implement rate limiting** for API endpoints
6. **Regular security audits** of RLS policies

## Troubleshooting

### RLS Not Working

If merchants can see each other's data:

1. Check RLS is enabled:
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
   ```

2. Re-apply migrations:
   ```bash
   npx supabase db push --linked
   ```

3. Verify policies exist:
   ```sql
   SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
   ```

### Webhooks Not Processing

1. Verify webhook secret is correct
2. Check webhook logs in Stripe Dashboard
3. Ensure your domain is publicly accessible
4. Check application logs for signature verification errors

## Monitoring

Set up monitoring for:

1. **Application Health**
   - Response times
   - Error rates
   - API usage

2. **Database**
   - Query performance
   - Connection pool usage
   - RLS policy violations

3. **Payments**
   - Failed payments
   - Webhook failures
   - Dispute rates