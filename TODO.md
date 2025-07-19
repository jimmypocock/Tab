# TODO - Tab API Platform

## High Priority 🔴

### Payment Processor Architecture - Merchant-Owned Accounts
- [ ] **Implement Multi-Processor Support Architecture**
  - Design database schema for storing encrypted processor credentials per merchant
  - Create processor abstraction layer/interface for multiple payment providers
  - Implement secure credential storage with encryption at rest
  - Add processor type enum (stripe, square, paypal, etc.)

- [ ] **Stripe Connect Alternative Implementation**
  - Remove hardcoded Stripe API keys from environment variables
  - Create merchant processor settings page in dashboard
  - Implement Stripe account connection flow (OAuth or API key input)
  - Store encrypted Stripe credentials per merchant in database
  - Update payment processing to use merchant's Stripe account
  - Implement webhook routing to merchant-specific endpoints

- [ ] **Payment Processor Abstraction Layer**
  - Create IPaymentProcessor interface with standard methods:
    - createPaymentIntent()
    - createCheckoutSession()
    - handleWebhook()
    - refund()
    - getPaymentStatus()
  - Implement StripeProcessor class
  - Create ProcessorFactory to instantiate correct processor
  - Update all payment endpoints to use abstraction layer

- [ ] **Merchant Processor Configuration UI**
  - Add "Payment Processors" section to merchant settings
  - Create processor connection wizard
  - Display connection status and test mode indicators
  - Add ability to disconnect/reconnect processors
  - Implement processor credential validation
  - Add test payment functionality

- [ ] **Security & Compliance**
  - Implement secure credential encryption using AES-256
  - Add audit logging for processor configuration changes
  - Ensure PCI compliance for handling processor credentials
  - Implement credential rotation mechanism
  - Add two-factor authentication for processor changes

- [ ] **Database Schema Updates**
  ```sql
  -- merchant_processors table
  CREATE TABLE merchant_processors (
    id UUID PRIMARY KEY,
    merchant_id UUID REFERENCES merchants(id),
    processor_type TEXT NOT NULL, -- 'stripe', 'square', 'paypal', etc.
    is_active BOOLEAN DEFAULT true,
    is_test_mode BOOLEAN DEFAULT true,
    encrypted_credentials JSONB NOT NULL, -- Encrypted API keys/tokens
    webhook_secret TEXT, -- Encrypted
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

- [ ] **Migration Strategy**
  - Create migration plan for existing Stripe integration
  - Maintain backward compatibility during transition
  - Provide clear upgrade path for existing merchants
  - Update documentation for new architecture

- [ ] **Future Payment Processor Support**
  - Square: Research API and implement SquareProcessor
  - PayPal: Implement PayPalProcessor with Braintree SDK
  - Authorize.net: Add support for traditional gateways
  - Regional processors: Add framework for country-specific processors

- [ ] **Implementation Notes & Considerations**
  - **Phase 1**: Implement with Stripe only, but with abstraction layer ready
  - **Phase 2**: Add Square and PayPal support
  - **Phase 3**: Open framework for community-contributed processors
  - **Testing**: Each processor needs test credentials/sandbox mode
  - **Documentation**: Processor-specific setup guides needed
  - **Support**: Consider processor-specific error handling and debugging
  - **Compliance**: Different processors have different compliance requirements

### UI Testing & Component Development
- [ ] **Create Missing React Components**
  - TabsList component (referenced in existing test)
  - Payment form components
  - Dashboard layout components
  - UI components library (buttons, inputs, modals, etc.)
  - Navigation components

- [ ] **Component Testing Infrastructure**
  - Fix Jest configuration for ESM modules
  - Set up Supabase mocking for components
  - Configure Stripe Elements testing
  - Add React Testing Library custom render utilities
  - Set up MSW (Mock Service Worker) for API mocking

- [ ] **Comprehensive Component Test Suite**
  - Payment flow components
  - Dashboard components (stats, charts, tables)
  - Form components with validation
  - Modal and dialog components
  - Authentication components
  - Error boundary components

- [ ] **E2E Test Implementation**
  - Fix Playwright test configuration
  - Set up test database seeding
  - Configure Stripe test mode webhooks
  - Add authentication flow tests
  - Test payment flows end-to-end
  - Mobile responsive testing

- [ ] **Visual Regression Testing**
  - Set up Playwright visual testing
  - Create component snapshots
  - Add responsive design tests
  - Set up CI/CD visual diff reports
  - Cross-browser visual testing

### API & Backend
- [ ] **Multi-Merchant Support**
  - Allow multiple merchants per user account
  - Merchant switching in dashboard
  - Separate API keys per merchant
  - Merchant-specific settings and branding
  - Each merchant has own payment processor connections

- [ ] **Simplify API Key Strategy for MVP**
  - Consider removing test/live distinction initially
  - Or make test mode behavior more obvious (test payments, etc.)
  - Add environment toggles in dashboard later

- [ ] **Add API Versioning Strategy**
  - Implement version headers
  - Support backward compatibility
  - Add deprecation notices

- [ ] **Implement Idempotency Keys**
  - Prevent duplicate charges
  - Add idempotency key support for POST requests
  - Store and validate keys in Redis
  - Ensure idempotency works across different payment processors

- [ ] **Add Pagination Metadata**
  - Return total count, has_next, has_previous
  - Implement cursor-based pagination option
  - Add Link headers for API navigation

### Security & Performance
- [ ] **Add API Key Scopes**
  - Read-only keys
  - Limited permission keys
  - Key rotation mechanism

- [ ] **Implement Request Signing**
  - HMAC signature validation
  - Replay attack prevention
  - Timestamp validation

- [ ] **Add Response Caching**
  - Cache GET requests in Redis
  - Implement cache invalidation
  - Add ETag support

## Medium Priority 🟡

### Developer Experience
- [ ] **Live API Playground**
  - Interactive endpoint testing
  - Real-time request/response
  - Save and share examples
  - OAuth flow testing

- [ ] **Postman/Insomnia Collection Export**
  - Auto-generate from API schema
  - Include example requests
  - Environment variables setup
  - Publish to Postman API Network

- [ ] **SDK Generation**
  - Node.js/TypeScript SDK
  - Python SDK
  - PHP SDK
  - Ruby SDK
  - Go SDK
  - OpenAPI spec generation

- [ ] **Webhook Testing Tools**
  - Webhook inspector UI
  - Replay failed webhooks
  - Webhook logs viewer
  - Mock webhook endpoints

### Documentation
- [ ] **API Changelog**
  - Version history
  - Breaking changes notices
  - Migration guides
  - RSS feed for updates

- [ ] **Interactive Tutorials**
  - Step-by-step guides
  - Code sandbox integration
  - Progress tracking
  - Completion certificates

- [ ] **Video Tutorial Series**
  - Getting started video
  - Integration walkthroughs
  - Best practices guide
  - Troubleshooting common issues

### Dashboard Features
- [ ] **Analytics Dashboard**
  - API usage metrics
  - Response time graphs
  - Error rate monitoring
  - Top endpoints by usage
  - Payment processor success rates
  - Processor-specific analytics

- [ ] **Webhook Management UI**
  - Add/edit webhook endpoints
  - View webhook history
  - Retry failed webhooks
  - Test webhook delivery
  - Configure processor-specific webhooks
  - Webhook secret rotation per processor

- [ ] **Invoice Builder UI**
  - Drag-and-drop invoice designer
  - Template management
  - Branding customization
  - PDF export options

## Low Priority 🟢

### Advanced Features
- [ ] **Platform Revenue Model (Future)**
  - Transaction fee collection options:
    - Percentage-based platform fee
    - Fixed fee per transaction
    - Subscription-based pricing
  - Revenue sharing with payment processors
  - Platform billing and invoicing
  - Merchant payout management

- [ ] **GraphQL API**
  - GraphQL endpoint
  - Schema introspection
  - Subscription support
  - Apollo integration

- [ ] **Batch Operations**
  - Bulk tab creation
  - Batch status updates
  - CSV import/export
  - Async job processing

- [ ] **Multi-currency Support**
  - Currency conversion
  - Exchange rate updates
  - Locale-specific formatting
  - Multi-currency reporting

- [ ] **Recurring Payments**
  - Subscription management
  - Recurring invoice generation
  - Payment retry logic
  - Dunning management

### Integrations
- [ ] **Zapier Integration**
  - Official Zapier app
  - Trigger/action definitions
  - Authentication flow
  - Template workflows

- [ ] **Accounting Software Integrations**
  - QuickBooks sync
  - Xero integration
  - FreshBooks connector
  - Wave accounting

- [ ] **E-commerce Platform Plugins**
  - WooCommerce plugin
  - Shopify app
  - BigCommerce integration
  - Magento extension

### Infrastructure
- [ ] **Multi-Processor Webhook Infrastructure**
  - Dynamic webhook endpoint routing based on processor
  - Webhook signature verification per processor type
  - Webhook event normalization across processors
  - Failed webhook retry queue per merchant
  - Webhook event logging and debugging tools

- [ ] **GitHub Actions Deployment Pipeline**
  - Automated deployment to Vercel/Railway
  - Environment-specific deployments (staging/production)
  - Database migration automation
  - Rollback capabilities
  - Secret management
  - Post-deployment health checks

- [ ] **Multi-region Deployment**
  - Geographic redundancy
  - Data residency options
  - Latency optimization
  - Compliance certifications

- [ ] **Advanced Monitoring**
  - Distributed tracing
  - APM integration
  - Custom metrics
  - SLA monitoring

## Future Considerations 🔮

- [ ] **AI-Powered Features**
  - Smart invoice categorization
  - Fraud detection
  - Payment prediction
  - Natural language API queries

- [ ] **Blockchain Integration**
  - Cryptocurrency payments
  - Smart contract invoicing
  - Immutable audit trail
  - NFT receipts

- [ ] **Mobile SDKs**
  - iOS SDK (Swift)
  - Android SDK (Kotlin)
  - React Native module
  - Flutter plugin

## Tech Debt 🧹

- [x] **Upgrade Dependencies**
  - ✅ Review and update all npm packages (Dependabot updates applied)
  - ✅ Migrate to latest Next.js features (Next.js 15 compatibility)
  - ✅ Update Stripe SDK (v3.7.0)
  - ✅ Supabase client updates
  - ✅ Zod v4 compatibility fixes
  - ✅ TypeScript strict mode compliance

- [ ] **Test Coverage**
  - ✅ Core unit tests passing (validation, utils, errors, integration)
  - [ ] Increase unit test coverage to 90%
  - [ ] Add more integration tests
  - [ ] Implement contract testing
  - [ ] Load testing scenarios
  - [ ] Component test coverage
  - [ ] E2E test coverage

- [ ] **Code Quality**
  - Set up SonarQube
  - Implement stricter linting rules
  - Add pre-commit hooks
  - Refactor legacy code

- [ ] **Documentation Debt**
  - API error response documentation
  - Internal code documentation
  - Architecture decision records
  - Deployment runbooks

## Completed ✅

- [x] Modern API documentation with interactive examples
- [x] Copy-to-clipboard functionality for code samples
- [x] Language switcher for code examples (cURL, JS, Python)
- [x] Comprehensive endpoint documentation
- [x] Database schema with proper snake_case naming
- [x] Local development setup script
- [x] Basic webhook implementation
- [x] Payment processing integration
- [x] Row-level security policies
- [x] **Dependency Updates (July 2025)**
  - Next.js 14 → 15.4.1 with full compatibility
  - Zod 3.22.4 → 4.0.5 with breaking change fixes
  - Updated all Stripe packages to latest versions
  - Updated Node types, date-fns, lucide-react, and more
  - Fixed all TypeScript compilation issues
  - ESLint configuration and code quality fixes
  - All builds passing with no warnings