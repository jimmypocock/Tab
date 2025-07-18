# GitHub Actions CI/CD

This directory contains the CI/CD pipeline configurations for the Tab application.

## Workflows

### CI Pipeline (`ci.yml`)
Runs on every push and pull request to ensure code quality:
- **Lint**: Runs ESLint to check code style
- **Test**: Runs Jest tests with coverage reporting
- **Build**: Ensures the application builds successfully
- **Type Check**: Runs TypeScript compiler to check for type errors
- **Security**: Runs security audits with npm audit and Trivy

### Deploy Pipeline (`deploy.yml`)
- **Production**: Automatically deploys to production when pushing to `main`
- **Preview**: Creates preview deployments for pull requests

## Required Secrets

Configure these secrets in your GitHub repository settings:

### For CI Pipeline
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `DATABASE_URL`: PostgreSQL connection string

### For Deployment
- `VERCEL_ORG_ID`: Your Vercel organization ID
- `VERCEL_PROJECT_ID`: Your Vercel project ID
- `VERCEL_TOKEN`: Your Vercel API token

## Dependabot

Automated dependency updates are configured in `dependabot.yml`:
- Weekly checks for npm dependencies
- Grouped updates for development dependencies
- Security patches applied automatically

## Branch Protection

Recommended branch protection rules for `main`:
- Require pull request reviews
- Require status checks to pass (lint, test, build, type-check)
- Require branches to be up to date
- Require code owner reviews
- Dismiss stale reviews on new commits