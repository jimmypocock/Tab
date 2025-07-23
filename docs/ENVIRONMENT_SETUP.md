# Environment Variables Setup Guide

## Overview

Tab uses different environment configurations for local development and production deployment. This guide explains how to set up both.

## Local Development (.env.local)

For local development, create a `.env.local` file in the root directory. This file is gitignored and should never be committed.

### Required Variables

```bash
# Supabase (Local)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from-supabase-start>
SUPABASE_SERVICE_ROLE_KEY=<from-supabase-start>

# Stripe (Test Mode)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Application
NEXT_PUBLIC_APP_URL=http://localhost:1235
PAYMENT_PROCESSOR_ENCRYPTION_KEY=<generate-with-script>

# Email (Resend)
RESEND_API_KEY=re_...
RESEND_DOMAIN=resend.dev  # Use for testing
```

## Production Deployment

For production, you'll set environment variables in your hosting platform (Vercel, Railway, etc.).

### Key Differences from Development

1. **Different API Keys**: Always use separate keys for production
2. **Live Stripe Keys**: Use `pk_live_` and `sk_live_` keys
3. **Production URLs**: Update all URLs to your domain
4. **Stronger Encryption**: Generate a new encryption key for production

### Deployment Platforms

#### Vercel
1. Go to Project Settings → Environment Variables
2. Add each variable from `.env.production.example`
3. Select "Production" environment

#### Railway
1. Go to Variables tab in your service
2. Add each variable
3. Railway auto-deploys on variable changes

#### Heroku
```bash
heroku config:set VARIABLE_NAME=value
```

## Security Best Practices

### 🚨 NEVER DO THIS:
- Commit `.env.local` or any file with real keys
- Share API keys in chat, email, or issues
- Use the same keys for dev and production
- Store keys in your code

### ✅ ALWAYS DO THIS:
- Use `.env.local` for local development
- Use platform environment variables for production
- Rotate keys regularly
- Use different keys for each environment
- Revoke compromised keys immediately

## Environment-Specific Features

### Development Only
- Test Stripe webhooks with CLI
- Local Supabase instance
- Debug logging enabled
- Test email domain (resend.dev)

### Production Only
- Live payment processing
- Production email domain
- Error tracking (Sentry)
- Rate limiting (Redis)

## Generating Secure Keys

### Encryption Key
```bash
# Generate a 64-character hex key
openssl rand -hex 32
```

### Or use the provided script
```bash
node scripts/generate-encryption-key.js
```

## Troubleshooting

### "Missing environment variable" errors
- Ensure all required variables are set
- Restart your dev server after changes
- Check for typos in variable names

### Email not sending
- Verify Resend API key is valid
- Check domain verification in Resend dashboard
- Use `resend.dev` for testing without domain verification

### Stripe webhooks failing
- Ensure webhook secret matches your endpoint
- Use ngrok for local testing
- Verify webhook events are enabled in Stripe

## Quick Start Checklist

- [ ] Copy `.env.example` to `.env.local`
- [ ] Run `npm run setup:local` for Supabase
- [ ] Add your Stripe test keys
- [ ] Generate encryption key
- [ ] Add Resend API key
- [ ] Start dev server with `npm run dev`

## Need Help?

1. Check that all required variables are set
2. Ensure no trailing spaces in values
3. Restart your development server
4. Check logs for specific error messages