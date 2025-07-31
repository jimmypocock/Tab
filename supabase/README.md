# Supabase Seed Data

This directory contains database migrations and seed data for local development.

## Quick Start

Reset your database with fresh seed data:

```bash
npm run supabase:reset
```

This automatically creates test users with passwords that work immediately. No manual setup needed!

## Test Users

All test users use password: `password123`

### Basic Users (created by seed.sql)
- **test@example.com** - Owner of Test Business Inc (merchant)
- **demo@example.com** - Owner of Demo Company LLC (merchant)

### Extended Team (created by seed-extended.sql)
Run `npm run supabase:seed` to add these additional users:
- **admin@testbusiness.com** - Admin at Test Business Inc
- **employee@testbusiness.com** - Member at Test Business Inc  
- **viewer@testbusiness.com** - Viewer (read-only) at Test Business Inc

## Test Data Created

### Organizations
- **Test Business Inc** - Primary test merchant
- **Demo Company LLC** - Secondary test merchant
- **Acme Corporation** - Corporate (non-merchant) account

### API Keys
For testing API endpoints without creating new keys:
- Test Business Inc: `tab_test_12345678901234567890123456789012`
- Demo Company LLC: `tab_test_98765432109876543210987654321098`

### Sample Data
- Multiple tabs with various statuses (open, paid, partial, void)
- Line items for tabs
- Sample invoices (when extended seed is run)
- Pending team invitations

## Commands

```bash
# Reset database with basic seed data
npm run supabase:reset

# Add extended seed data (more users, tabs, invoices)
npm run supabase:seed

# Reset and apply all seed data at once
npm run supabase:reset:full
```

## Adding Your Own Seed Data

1. Edit `seed.sql` for basic data that should always be present
2. Edit `seed-extended.sql` for optional rich test data
3. Use the same pattern: create auth users with `crypt()` function for passwords

Example of adding a new test user:

```sql
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated', 
  'newuser@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  '', '', '', '',
  '{}',
  '{"custom": "metadata"}'::JSONB,
  NOW(),
  NOW()
);
```

## Loading Production-like Data

If you need to load anonymized production data:

1. Export data from production (ensure it's properly anonymized)
2. Create a new file like `seed-production-snapshot.sql`
3. Use the same auth user creation pattern with test passwords
4. Run with: `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/seed-production-snapshot.sql`

## Tips

- The seed data uses fixed UUIDs for primary test users, making tests predictable
- All auth users are created with confirmed emails and proper password hashing
- The `handle_new_user` trigger automatically creates organizations for new users
- Extended seed data creates realistic scenarios for testing different features