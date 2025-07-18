# Local Development with Supabase

This guide explains how to set up Supabase for local development.

## Prerequisites

- Docker Desktop installed and running
- Node.js 18+ installed

## Option 1: Supabase CLI (Recommended)

### 1. Install Supabase CLI

```bash
# Using npm
npm install -g supabase

# Or using Homebrew (macOS)
brew install supabase/tap/supabase
```

### 2. Initialize Supabase

```bash
# Initialize Supabase in your project
supabase init

# Start local Supabase services
supabase start
```

This will start:
- PostgreSQL database (port 54322)
- Auth service (port 54321)
- Storage service
- Realtime service
- Edge Functions runtime

### 3. Get Local Connection Details

After starting Supabase, you'll see output like:

```
Started supabase local development setup.

         API URL: http://localhost:54321
          DB URL: postgresql://postgres:postgres@localhost:54322/postgres
      Studio URL: http://localhost:54323
    Inbucket URL: http://localhost:54324
        anon key: eyJh...
service_role key: eyJh...
```

### 4. Create `.env.local` for Local Development

Create a `.env.local` file with your local Supabase configuration:

```bash
# Local Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key

# Local Database URL
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
SUPABASE_DB_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Keep your production Stripe keys for testing
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:1235
NODE_ENV=development

# Optional: Redis (if using local Redis)
UPSTASH_REDIS_REST_URL=http://localhost:6379
UPSTASH_REDIS_REST_TOKEN=local-dev-token
```

### 5. Run Database Migrations

```bash
# Apply existing migrations to your local database
supabase db push

# Or using Drizzle directly
npm run db:push
```

### 6. Seed Local Database (Optional)

Create a seed file to populate your local database with test data:

```bash
# Create seed file
touch supabase/seed.sql
```

Example seed data:
```sql
-- Insert test merchant
INSERT INTO merchants (id, email, business_name)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'test@example.com', 'Test Business');

-- Insert test API key
INSERT INTO api_keys (merchant_id, key_hash, key_prefix, name, is_active)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 
   SHA256('tab_test_12345678901234567890123456789012'), 
   'tab_test',
   'Test API Key',
   true);
```

Run the seed:
```bash
supabase db seed
```

## Option 2: Remote Supabase Database (Simpler)

If you don't want to run Docker locally, you can create a separate Supabase project for development:

1. Create a new project on [supabase.com](https://supabase.com) for development
2. Use those credentials in your `.env.local`
3. This gives you a real Postgres database without local setup

## Switching Between Local and Production

### Environment-Specific Config Files

- `.env.local` - Local development (git-ignored)
- `.env.production` - Production environment variables
- `.env.test` - Test environment

### Using Multiple Supabase Projects

Create separate npm scripts for different environments:

```json
{
  "scripts": {
    "dev:local": "supabase start && next dev",
    "dev:remote": "next dev",
    "db:push:local": "DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres drizzle-kit push:pg",
    "db:push:remote": "drizzle-kit push:pg"
  }
}
```

## Useful Supabase CLI Commands

```bash
# Start local Supabase
supabase start

# Stop local Supabase
supabase stop

# Reset local database
supabase db reset

# View local logs
supabase logs

# Access local Studio UI
open http://localhost:54323

# Generate types from your schema
supabase gen types typescript --local > lib/database.types.ts
```

## Troubleshooting

### Docker Issues
- Ensure Docker Desktop is running
- Check Docker has enough resources allocated (at least 4GB RAM)

### Port Conflicts
If ports are already in use, you can configure custom ports:

```bash
supabase start --api-port 54320 --db-port 54321
```

### Database Connection Issues
- Check that all services started successfully with `supabase status`
- Verify your connection string in `.env.local`
- Try connecting directly: `psql postgresql://postgres:postgres@localhost:54322/postgres`

## Best Practices

1. **Keep local and production schemas in sync**
   - Always create migrations when changing schema
   - Apply migrations to both environments

2. **Use seed data for local development**
   - Create realistic test data
   - Include edge cases in your seed

3. **Separate API keys for each environment**
   - Never use production keys locally
   - Generate test Stripe webhooks for local development

4. **Version control your migrations**
   - Commit all files in `/supabase/migrations`
   - Document significant schema changes

## Next Steps

1. Install Supabase CLI: `npm install -g supabase`
2. Run `supabase init` in your project root
3. Start local services: `supabase start`
4. Update your `.env.local` with local credentials
5. Run migrations: `npm run db:push`
6. Start developing: `npm run dev`