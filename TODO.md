# TODO - Tab Payment Orchestration Platform

## 🚨 CRITICAL PRIORITY - TEST SUITE FIXES (JANUARY 25, 2025) 🚨

**Status**: 763 passing tests out of 824 total (92.6% pass rate) - **50 failing tests remaining**
**Progress**: Major improvement from previous ~80% pass rate, but critical infrastructure issues blocking development

### IMMEDIATE ACTION REQUIRED - DATABASE MOCK STRUCTURE ISSUES 🔴

**Primary Issue**: The service mocking pattern is broken. Database query chains aren't properly implemented in jest.setup.ts, causing API tests to fail with `orderBy is not a function` errors.

#### Root Cause Analysis (January 24, 2025 Session)
```typescript
// Failing pattern in billing-group.service.ts:749
return await db
  .select()
  .from(billingGroups)
  .where(eq(billingGroups.tabId, tabId))
  .orderBy(asc(billingGroups.createdAt))  // ❌ orderBy is not a function

// Issue: Multiple overlapping database mocks in jest.setup.ts
// 1. Mock for 'drizzle-orm/postgres-js' (older, enhanced but not used)
// 2. Mock for '@/lib/db' (global, actually used but incomplete)
```

#### CRITICAL FIXES NEEDED (HIGHEST PRIORITY)

1. **Fix Database Mock Chain Implementation** 🔴 IMMEDIATE
   ```typescript
   // Current broken pattern in jest.setup.ts around line 397:
   const createMockQueryChain = (value = []) => {
     const chain = {
       from: jest.fn(() => createMockQueryChain(value)),
       where: jest.fn(() => createMockQueryChain(value)),
       orderBy: jest.fn(() => createMockQueryChain(value)), // Should return chain, not thenable!
       limit: jest.fn(() => createThenable(value)),
       // ... more methods
     }
   }
   
   // Fix: Ensure ALL query methods return proper chains
   // Fix: Test the mock with actual service patterns before deployment
   ```

2. **Service Method Mocking Strategy** 🔴 HIGH PRIORITY
   ```typescript
   // Alternative approach: Mock at service level instead of database level
   jest.mock('@/lib/services/billing-group.service', () => ({
     BillingGroupService: {
       getTabBillingSummary: jest.fn().mockResolvedValue(mockSummaryData),
       getTabBillingGroups: jest.fn().mockResolvedValue(mockGroupsData),
       // ... other methods
     }
   }))
   
   // This would be more reliable than database-level mocking
   ```

3. **Fix API Test Database Integration** 🔴 HIGH PRIORITY
   - 6 failing tests in `billing-summary.test.ts` 
   - All returning 500 status instead of 200
   - Error: `db.select(...).from(...).where(...).orderBy is not a function`
   - Service calls hitting real database mock instead of proper chain

#### AFFECTED TEST FILES (50 failing tests total)
- `__tests__/api/billing-groups/billing-summary.test.ts` (6 failures) 
- `__tests__/api/tabs.test.ts` (worker exceptions)
- `__tests__/components/billing-groups/BillingGroupsManager.test.tsx` (component rendering)
- Various API tests with database chain issues

#### IMMEDIATE NEXT STEPS (Morning Priority)

1. **Debug and Fix Global Database Mock** (30 minutes)
   - Check why `@/lib/db` mock isn't working properly
   - Ensure `orderBy` method returns proper chain structure
   - Test mock chains with actual service call patterns

2. **Implement Service-Level Mocking** (45 minutes)
   - Create service mocks for billing group tests
   - Move away from database-level mocking for API tests
   - Implement proper mock data fixtures

3. **Fix Worker Exception in tabs.test.ts** (15 minutes)
   - "Jest worker encountered 4 child process exceptions"
   - Likely memory/timing issue with database operations

4. **Validate All API Tests Pass** (30 minutes)
   - Run full API test suite
   - Ensure 200 responses instead of 500 errors
   - Verify mock data matches expected formats

### SECONDARY ISSUES (After Database Mocks Fixed)

#### Integration Test Refactoring 🟡 MEDIUM PRIORITY
- `__tests__/integration/user-signup-flow.test.tsx` has circular reference issues
- "Maximum call stack size exceeded" error
- Needs complete refactoring or removal (complex integration test)

#### Component Test Issues 🟡 MEDIUM PRIORITY
- BillingGroupsManager test expecting different text format
- Timing issues with async component updates
- Need data-testid attributes for reliable component testing

#### API Route Export Issues 🟡 LOW PRIORITY
- Missing PUT handler exports in some routes
- Import path mismatches in test files
- Standard error response format inconsistencies

### SUCCESS CRITERIA

**100% Test Suite Green Before Any New Development**
- All 824 tests passing (currently 763/824)
- No test infrastructure warnings or errors
- Reliable test runs without flaky failures
- Fast test execution (<30 seconds for full suite)

### WHY THIS IS CRITICAL

**Development Velocity**: Broken tests slow down all feature development
**Code Quality**: Can't trust test results with infrastructure issues
**Deployment Safety**: Broken tests hide real bugs in production code
**Team Confidence**: Developers avoid running tests when they're unreliable

### ESTIMATED TIME TO RESOLUTION
- **Database Mock Fixes**: 2-3 hours
- **Service Mock Implementation**: 1-2 hours  
- **Full Test Suite Validation**: 1 hour
- **Total**: 4-6 hours of focused work

### RESOURCES NEEDED
- Full console logs from failing tests
- Database query patterns from actual service calls
- Mock data fixtures that match API expectations
- Test execution environment debugging

---

## 🚨 IMMEDIATE PRIORITY - BILLING GROUPS (GENERALIZED FOLIO SYSTEM) 🚨

### Feature: Flexible Billing Groups for Multi-Payer Scenarios

**Vision**: Transform the hotel-specific folios concept into a flexible "billing groups" system that works across industries - hotels, construction, healthcare, legal, restaurants, and more.

**Business Value**: 
- Enable businesses to split charges across multiple payers (individuals, departments, companies)
- Automate charge routing based on configurable rules
- Track deposits and prepayments per billing group
- Generate separate invoices per billing group while maintaining unified reporting

**Status**: 🔴 TOP PRIORITY - Database schema exists (hotel_folios) but needs generalization

**Update**: ✅ Obsolete corporate routes and services have been removed. Unified organizations model is now in place.

---

### Phase 1: Database Schema Updates ✅ COMPLETED

1. **Progressive Enhancement Architecture** 🎯
   - **No billing groups by default** - Simple tabs remain simple
   - **Opt-in complexity** - Billing groups created only when needed
   - **Backward compatible** - Existing tabs work unchanged
   - **Smart defaults** - Intelligent group creation when enabled

2. **Database Design** ✅
   ```sql
   -- Core billing_groups table (IMPLEMENTED)
   billing_groups {
     id, tab_id, invoice_id,
     name, group_number, group_type,
     payer_organization_id, payer_email,
     status, credit_limit, current_balance,
     deposit_amount, deposit_applied,
     authorization_code, po_number,
     metadata, created_at, updated_at
   }
   
   -- line_items.billing_group_id is NULLABLE
   -- NULL = Simple tab (no groups)
   -- UUID = Assigned to specific group
   ```

3. **Migration Completed** ✅
   - ✅ Renamed hotel_folios → billing_groups
   - ✅ Added generalized columns
   - ✅ Created billing_group_rules table
   - ✅ Added billing_group_id to line_items (nullable)
   - ✅ Added RLS policies
   - ✅ Migration applied to local database

---

### Phase 2: Backend Implementation 🔴 HIGH PRIORITY

1. **BillingGroupService** (`/lib/services/billing-group.service.ts`)
   - [ ] CRUD operations for billing groups
   - [ ] Rule evaluation engine
   - [ ] Automatic charge routing based on rules
   - [ ] Deposit tracking and application
   - [ ] Balance calculations per group

2. **Enhanced Tab/Line Item Services**
   - [ ] Update TabService to support billing groups
   - [ ] Modify line item creation to accept billing_group_id
   - [ ] Add charge routing logic when creating line items
   - [ ] Support billing group overrides

3. **Rule Engine Implementation**
   - [ ] Create RuleEvaluator class
   - [ ] Support multiple condition types (category, amount, time, metadata)
   - [ ] Priority-based rule matching
   - [ ] Learn from manual overrides (track override patterns)

4. **Invoice Generation Updates**
   - [ ] Generate separate invoices per billing group
   - [ ] Maintain relationship between tab and multiple invoices
   - [ ] Support consolidated views

5. **Security & Permissions**
   - [ ] RLS policies for billing groups
   - [ ] Ensure proper access control
   - [ ] Audit logging for financial changes

---

### Phase 3: API Layer 🔴 HIGH PRIORITY

1. **New API Endpoints**
   ```typescript
   // Billing Groups
   GET    /api/v1/tabs/:id/billing-groups
   POST   /api/v1/tabs/:id/billing-groups
   PUT    /api/v1/billing-groups/:id
   DELETE /api/v1/billing-groups/:id
   
   // Rules
   GET    /api/v1/billing-groups/:id/rules
   POST   /api/v1/billing-groups/:id/rules
   PUT    /api/v1/rules/:id
   DELETE /api/v1/rules/:id
   
   // Charge Assignment
   POST   /api/v1/line-items/:id/assign
   POST   /api/v1/line-items/bulk-assign
   
   // Reporting
   GET    /api/v1/tabs/:id/billing-summary
   GET    /api/v1/billing-groups/:id/balance
   ```

2. **Enhanced Line Item Creation**
   - [ ] Accept billing_group_id in POST /api/v1/line-items
   - [ ] Auto-routing based on rules if no group specified
   - [ ] Return routing explanation (which rule matched)

3. **Corporate Integration**
   - [ ] Allow corporate accounts to set default billing rules
   - [ ] Support approval workflows for certain charge types
   - [ ] Real-time visibility into charges

---

### Phase 4: UI Implementation 🔴 CRITICAL

1. **Merchant Dashboard - Billing Group Management**
   ```
   /dashboard/tabs/[id]/billing-groups
   ```
   - [ ] Visual billing group cards showing payer info and balance
   - [ ] Drag-and-drop interface to move charges between groups
   - [ ] Quick-create billing groups with templates
   - [ ] Rule builder with visual conditions

2. **Point of Sale Integration**
   ```
   /dashboard/tabs/[id]/add-charge
   ```
   - [ ] Show auto-assigned billing group with explanation
   - [ ] One-click override with reason tracking
   - [ ] Visual indicators for charges requiring approval
   - [ ] Batch charge entry with smart routing

3. **Rule Management Interface**
   ```
   /dashboard/settings/billing-rules
   ```
   - [ ] Visual rule builder (if-then interface)
   - [ ] Rule testing sandbox
   - [ ] Override analytics (which rules get overridden most)
   - [ ] Template library for common industries

4. **Organization Billing Rules** (For orgs with corporate capabilities)
   ```
   /dashboard/settings/billing-relationships
   ```
   - [ ] Set rules for direct billing relationships
   - [ ] Approval workflows configuration
   - [ ] Real-time charge monitoring
   - [ ] Spending analytics by category

5. **Guest/Customer View**
   ```
   /pay/tab/[id]
   ```
   - [ ] Clear breakdown by billing group
   - [ ] Pay individual group or entire balance
   - [ ] Dispute charges interface
   - [ ] Download receipts per group

---

### Phase 5: Testing & Security 🔴 REQUIRED

1. **Comprehensive Test Suite**
   - [ ] Unit tests for BillingGroupService
   - [ ] Rule engine test scenarios
   - [ ] API endpoint integration tests
   - [ ] UI component tests
   - [ ] E2E tests for complete workflows

2. **Security Testing**
   - [ ] RLS policy verification
   - [ ] Permission boundary tests
   - [ ] Financial calculation accuracy
   - [ ] Audit trail completeness

3. **Performance Testing**
   - [ ] Rule evaluation performance
   - [ ] Large tab handling (100+ line items)
   - [ ] Concurrent billing group updates
   - [ ] Database query optimization

---

### Use Case Implementations 🎯

1. **Hotel Example** (Original Use Case)
   - Room charges → Company billing group
   - Personal expenses → Guest billing group
   - Conference fees → Company billing group
   - Spa/dining → Personal (unless business hours)

2. **Construction Company**
   - Materials → Project Phase 1 group
   - Labor → Project Phase 2 group
   - Equipment rental → Overhead group
   - Change orders → Client approval group

3. **Healthcare Provider**
   - Covered procedures → Insurance group
   - Copays → Patient group
   - Non-covered → Patient responsibility group
   - Lab work → Secondary insurance group

4. **Law Firm**
   - Billable hours → Client matter group
   - Court fees → Client expense group
   - Research databases → Firm overhead group
   - Expert witnesses → Special billing group

5. **Restaurant Group Event**
   - Appetizers → Shared/split evenly group
   - Individual meals → Personal groups
   - Drinks → Separate bar tab group
   - Service charge → Auto-split group

---

### Success Metrics 📊

- **Phase 1 Complete**: Database schema migrated and tested
- **Phase 2 Complete**: Backend services operational with 90%+ test coverage
- **Phase 3 Complete**: All API endpoints functional with documentation
- **Phase 4 Complete**: UI fully implemented with user testing
- **Phase 5 Complete**: Security audit passed, performance benchmarks met

**Target Timeline**: 4-6 weeks for full implementation

**Expected Impact**:
- 50% reduction in manual charge assignment time
- 90% accuracy in automatic routing
- 30% increase in customer satisfaction (clear billing)
- New revenue stream from premium rule features

---

## STRATEGIC PIVOT: Multi-Processor Orchestration Platform 🎯

## STRATEGIC PIVOT: Multi-Processor Orchestration Platform 🎯

**Vision**: Build the payment orchestration layer that billion-dollar processors can't - enabling businesses to optimize payment routing across multiple processors with intelligent failover, cost optimization, and unified reporting.

**Target Market**: Mid-market businesses ($50M-$1B revenue) that have outgrown single-processor solutions but can't afford enterprise orchestration platforms.

**Core Value Proposition**:

- Save 5-10% on processing costs through intelligent routing
- Increase authorization rates by 10-15% with automatic failover
- Unified dashboard for all payment processors
- Zero vendor lock-in

---

## IMMEDIATE PRIORITY: Console Statement Cleanup ✅ COMPLETED

### Console Statement Removal - Clean up all console.log/error/warn statements (69 total) ✅

- [x] **Clean up Stripe webhook console.logs** (7 occurrences in `/app/api/v1/webhooks/stripe/route.ts`)
  - ✅ Replaced with logger service calls
  - ✅ Lines: 29, 35, 56, 83, 94, 110, 240

- [x] **Replace console.errors in authentication flows** with toast notifications
  - ✅ Accept invitation page - added toast notifications
  - ✅ Created auth layout with ToastProvider
  - ✅ All auth errors now show user-friendly messages

- [x] **Replace console.errors in API routes** with proper error responses
  - ✅ All API routes now use logger.error with proper context
  - ✅ Consistent error response format maintained
  - ✅ Better debugging with structured logging

- [x] **Replace console.errors in dashboard components** with toast notifications
  - ✅ Team management - shows success/error toasts
  - ✅ Processor settings - clipboard and error notifications
  - ✅ Tabs list - loading and copy notifications
  - ✅ Webhook status - error notifications

- [x] **Clean up console.warns** (4 occurrences)
  - ✅ API middleware - now uses logger.warn for deprecations
  - ✅ Invoice service - uses logger.warn with context

- [x] **Remove console statements from services**
  - ✅ Invitation service - replaced with logger.debug
  - ✅ All service layer console statements updated

**Note**: The logger service (`/lib/logger/index.ts`) has legitimate console statements as part of its implementation - these remain unchanged.

---

## PHASE 1: MVP Foundation (0-3 months) 🔴

### 1.1 Multi-Processor Core Architecture 🔴 CRITICAL PATH

**Goal**: Build the foundation for processor-agnostic payment orchestration

#### Payment Processor Abstraction Layer ✅ COMPLETED

- [x] IPaymentProcessor interface with standard methods
- [x] StripeProcessor implementation with full functionality
- [x] ProcessorFactory for dynamic processor instantiation
- [x] Secure credential storage with AES-256-GCM encryption
- [x] Processor configuration UI in dashboard

#### Intelligent Routing Engine 🔴 HIGH PRIORITY

- [ ] **Basic Routing Rules** (Week 1-2)
  - [ ] Card type routing (debit vs credit)
  - [ ] Amount-based routing (micropayments vs large transactions)
  - [ ] Geographic routing (domestic vs international)
  - [ ] Processor availability checks
  
- [ ] **Failover Logic** (Week 2-3)
  - [ ] Primary/secondary processor configuration
  - [ ] Automatic failover on declined transactions
  - [ ] Health check monitoring for processors
  - [ ] Circuit breaker pattern implementation
  
- [ ] **Cost Optimization** (Week 3-4)
  - [ ] Real-time fee calculation per processor
  - [ ] Routing based on lowest cost
  - [ ] Volume-based routing for better rates
  - [ ] Monthly savings tracking

#### Unified Payment API 🔴 HIGH PRIORITY

- [ ] **Normalized Payment Interface**
  - [ ] Single API for all processors
  - [ ] Consistent error handling across processors
  - [ ] Unified webhook handling
  - [ ] Transaction status normalization
  
- [ ] **Smart Payment Creation**

  ```typescript
  POST /api/v1/payments/orchestrated
  {
    amount: 10000,
    currency: "USD",
    routing_strategy: "lowest_cost" | "highest_success" | "fastest",
    fallback_enabled: true,
    processors: ["stripe", "square"] // optional override
  }
  ```

### 1.2 Processor Integrations 🔴 EXPAND COVERAGE

#### Square Integration (Week 4-6)

- [ ] **SquareProcessor Implementation**
  - [ ] OAuth2 authentication flow
  - [ ] Payment creation and capture
  - [ ] Refund functionality
  - [ ] Webhook handling
  - [ ] Error mapping to unified format
  
- [ ] **Square-specific Features**
  - [ ] Terminal/POS integration support
  - [ ] Inventory sync capabilities
  - [ ] Customer directory integration
  - [ ] Loyalty program hooks

#### PayPal/Braintree Integration (Week 6-8)

- [ ] **PayPalProcessor Implementation**
  - [ ] OAuth2 authentication
  - [ ] PayPal Checkout integration
  - [ ] Venmo support
  - [ ] International payment handling
  - [ ] Currency conversion features

### 1.3 Analytics & Reporting Dashboard 🔴 DIFFERENTIATION

#### Unified Analytics (Week 8-10) - Inspired by Market Zero's Omnichannel Dashboard

- [ ] **Cross-Processor Metrics**
  - [ ] Combined authorization rates
  - [ ] Processing cost comparison
  - [ ] Transaction volume by processor
  - [ ] Failure reason analysis
  - [ ] Geographic performance data
  - [ ] Single dashboard for all payment operations (no multi-platform login)
  
- [ ] **Cost Savings Dashboard with What-If Analysis**
  - [ ] Real-time savings tracker
  - [ ] Month-over-month comparison
  - [ ] Routing effectiveness metrics
  - [ ] Projected annual savings
  - [ ] What-if analysis tools for routing strategies
  - [ ] Simulate different processor configurations before deployment
  
- [ ] **Performance Monitoring**
  - [ ] Processor uptime tracking
  - [ ] Average response times
  - [ ] Success rate trends
  - [ ] Anomaly detection alerts
  - [ ] Transaction failure prediction (adapted from churn prediction)

### 1.4 Security & Compliance Hardening 🔴 TRUST BUILDING

#### Enhanced Security (Ongoing)

- [ ] **PCI DSS Compliance**
  - [ ] Complete SAQ-D assessment
  - [ ] Implement network segmentation
  - [ ] Enhanced audit logging
  - [ ] Quarterly security scans
  
- [ ] **Advanced Encryption**
  - [ ] Hardware Security Module (HSM) integration
  - [ ] Key rotation automation
  - [ ] Encryption key versioning
  - [ ] Zero-knowledge architecture planning
  
- [ ] **Compliance Framework**
  - [ ] SOC 2 Type II preparation
  - [ ] GDPR compliance tools
  - [ ] Data residency controls
  - [ ] Right to deletion automation

### 1.5 Self-Service Platform Infrastructure 🔴 REDUCE SUPPORT OVERHEAD

#### Subscription & Billing System (Week 10-12) - Based on Market Zero Model

- [ ] **Platform Subscription Management**
  - [ ] Tiered pricing implementation:
    - [ ] Starter: $199/month (2 processors, basic routing)
    - [ ] Growth: $499/month (3-5 processors, smart routing)
    - [ ] Scale: $999/month (unlimited processors, ML optimization)
    - [ ] Enterprise: Custom pricing (white-label, SLA)
  - [ ] Self-service subscription portal
  - [ ] Upgrade/downgrade workflows
  - [ ] Usage-based billing tracking
  
- [ ] **Smart Dunning & Retention**
  - [ ] Failed payment recovery
  - [ ] Churn prediction algorithms
  - [ ] Automated retention campaigns
  - [ ] Win-back workflows
  
- [ ] **Customer Self-Service Portal**
  - [ ] Processor connection wizard
  - [ ] Routing rule builder (visual interface)
  - [ ] Performance analytics dashboard
  - [ ] Billing and subscription management
  - [ ] Support ticket system integration

---

## PHASE 2: Market Differentiation (3-6 months) 🟡

### 2.1 Advanced Orchestration Features

#### ML-Powered Optimization - Evolution from Rule-Based (Market Zero Pattern)

- [ ] **Start with Rule-Based Optimization**
  - [ ] Business rule engine for routing
  - [ ] Manual threshold configuration
  - [ ] Basic if-then routing logic
  - [ ] Quick to implement and test
  
- [ ] **Evolve to Predictive Routing**
  - [ ] Success rate prediction model
  - [ ] Cost prediction algorithms
  - [ ] Fraud score integration
  - [ ] Real-time model updates
  - [ ] Learn from transaction history
  
- [ ] **Dynamic Routing Rules**
  - [ ] Time-based routing (processor performance by hour)
  - [ ] Customer segment routing
  - [ ] Risk-based routing
  - [ ] A/B testing framework
  - [ ] What-if analysis before rule deployment

#### Advanced Processor Features

- [ ] **Network Tokenization**
  - [ ] Multi-processor token vault
  - [ ] Token lifecycle management
  - [ ] Cross-processor token portability
  - [ ] Automatic token updates
  
- [ ] **3D Secure Orchestration**
  - [ ] Intelligent 3DS routing
  - [ ] Exemption management
  - [ ] Liability shift optimization
  - [ ] Frictionless flow maximization

### 2.2 Enterprise Features

#### Multi-Entity Support

- [ ] **Subsidiary Management**
  - [ ] Parent-child account structure
  - [ ] Consolidated reporting
  - [ ] Cross-entity payment routing
  - [ ] Centralized configuration
  
- [ ] **White-Label Capabilities**
  - [ ] Custom branding per account
  - [ ] API subdomain support
  - [ ] Branded payment pages
  - [ ] Custom email templates

#### Advanced Integrations

- [ ] **ERP Integrations**
  - [ ] SAP connector
  - [ ] Oracle NetSuite integration
  - [ ] Microsoft Dynamics sync
  - [ ] Custom ERP webhooks
  
- [ ] **Accounting Automation**
  - [ ] Automated reconciliation
  - [ ] Multi-processor settlement reports
  - [ ] Revenue recognition tools
  - [ ] Audit trail exports

### 2.3 Developer Platform

#### SDK Development

- [ ] **Official SDKs**
  - [ ] Node.js/TypeScript SDK
  - [ ] Python SDK
  - [ ] Go SDK
  - [ ] Ruby SDK
  - [ ] PHP SDK
  
- [ ] **Developer Tools**
  - [ ] Sandbox environment per processor
  - [ ] Test card database
  - [ ] Webhook testing tools
  - [ ] API request builder

---

## PHASE 3: Scale & Expand (6-12 months) 🟢

### 3.1 Global Expansion

#### International Processors

- [ ] **Regional Processors**
  - [ ] Adyen integration (Europe)
  - [ ] Razorpay (India)
  - [ ] MercadoPago (Latin America)
  - [ ] Alipay/WeChat Pay (China)
  
- [ ] **Local Payment Methods**
  - [ ] SEPA Direct Debit
  - [ ] ACH payments
  - [ ] Bank transfers
  - [ ] Digital wallets

### 3.2 Platform Marketplace

#### Processor Marketplace - Modular Architecture (Market Zero Approach)

- [ ] **Partner Program**
  - [ ] Self-service processor onboarding
  - [ ] Revenue sharing model
  - [ ] Certification program
  - [ ] Marketing co-op
  - [ ] Modular Lambda functions per processor (easy to add new ones)
  
- [ ] **Community Processors**
  - [ ] Open-source processor framework
  - [ ] Community contribution guidelines
  - [ ] Processor template library
  - [ ] Testing harness
  - [ ] Event-driven architecture for processor events

### 3.3 Advanced Analytics

#### Business Intelligence

- [ ] **Predictive Analytics**
  - [ ] Churn prediction
  - [ ] Revenue forecasting
  - [ ] Optimal processor mix recommendations
  - [ ] Cost optimization suggestions
  
- [ ] **Industry Benchmarking**
  - [ ] Anonymized performance data
  - [ ] Industry-specific metrics
  - [ ] Peer comparison tools
  - [ ] Best practices recommendations

---

## Technical Foundation (Ongoing) 🔧

### Performance & Reliability

#### Infrastructure Hardening ✅ PARTIAL

- [x] Database query optimization with indexes
- [x] RLS policy optimization
- [ ] **High Availability**
  - [ ] Multi-region deployment
  - [ ] Database replication
  - [ ] Automatic failover
  - [ ] 99.99% uptime SLA
  
- [ ] **Performance Optimization**
  - [ ] Redis caching layer
  - [ ] CDN for static assets
  - [ ] Database connection pooling
  - [ ] Query result caching
  
- [ ] **Event-Driven Architecture** (Market Zero Pattern)
  - [ ] SQS queues for reliable processing
  - [ ] EventBridge for scheduled tasks
  - [ ] Lambda functions for processor-specific logic
  - [ ] Real-time event streaming for dashboards

### Testing & Quality

#### Test Infrastructure Fixes 🔴 CRITICAL PATH

**Status**: 24 failing tests out of 697 total (96.6% pass rate, but critical infrastructure issues)

- [ ] **Fix Database Mock Structure Issues** 🔴 IMMEDIATE PRIORITY
  - [ ] Update Drizzle ORM mocks to match actual API patterns:

    ```typescript
    // Fix: db.update().set().where().returning() chain
    // Fix: db.transaction() callback structure  
    // Fix: db.query.table.findFirst() response format
    ```

  - [ ] Ensure all database operations return proper mock responses
  - [ ] Test mock chains work with actual Drizzle query patterns
  - [ ] Fix webhook test database mock structure (8 failing webhook tests)

- [ ] **Fix API Route Import/Export Issues** 🔴 HIGH PRIORITY  
  - [ ] Fix missing PUT route handler exports in tabs CRUD
  - [ ] Verify all API route files export expected methods (GET, POST, PUT, DELETE)
  - [ ] Fix import path mismatches in test files
  - [ ] Ensure test imports match actual file structure

- [ ] **Standardize Error Response Format** 🟡 MEDIUM PRIORITY
  - [ ] Align webhook error messages: "Invalid signature" vs "Missing stripe signature"
  - [ ] Consistent NotFoundError handling across all endpoints
  - [ ] Update test expectations to match actual API responses
  - [ ] Document standard error response format

- [ ] **Fix Test Calculation & Timing Issues** 🟡 MEDIUM PRIORITY
  - [ ] Debug tab total calculation discrepancies ($10.00 vs $60.00)
  - [ ] Fix async timing issues in React component tests
  - [ ] Improve clipboard API mock reliability
  - [ ] Add proper waitFor conditions for state updates

#### Comprehensive Testing ✅ STARTED  

- [x] Unit tests for core services (672 passing)
- [x] Security test suite (9 security tests passing)
- [ ] **Extended Test Coverage**
  - [ ] Integration tests for all processors
  - [ ] End-to-end payment flow tests  
  - [ ] Load testing scenarios
  - [ ] Chaos engineering tests
  - [ ] Multi-processor scenario tests

#### Test Architecture Improvements 🔄 FUTURE ENHANCEMENT

- [ ] **Consider Service Layer Mocking**
  - [ ] Mock at service level instead of database level for more reliable tests
  - [ ] Create test fixtures for common scenarios
  - [ ] Use actual test database for integration tests
  - [ ] Implement API contract testing to catch response format changes

### Monitoring & Observability

#### Full Stack Monitoring

- [ ] **Application Monitoring**
  - [ ] APM with DataDog/New Relic
  - [ ] Custom metrics dashboards
  - [ ] Real-time alerting
  - [ ] Distributed tracing
  
- [ ] **Business Monitoring**
  - [ ] Payment success monitoring
  - [ ] Processor health tracking
  - [ ] Cost anomaly detection
  - [ ] Customer experience metrics

---

## Success Metrics 📊

### Phase 1 Goals (3 months)

- 10 pilot customers processing $1M+ monthly
- 2-3 processor integrations complete
- 5-10% demonstrated cost savings (with clear ROI dashboard)
- 99.9% platform uptime
- Self-service onboarding for 80% of customers

### Phase 2 Goals (6 months)

- 100 paying customers
- $50K+ MRR (subscription-based revenue)
- 5 processor integrations
- SOC 2 Type I certification
- 70% of customers on self-service (reduce support costs)

### Phase 3 Goals (12 months)

- 500 customers
- $250K+ MRR
- 10+ processor integrations
- Series A ready metrics
- Platform stickiness: <5% monthly churn

---

## Risk Mitigation 🛡️

### Technical Risks

- **Processor API Changes**: Maintain abstraction layer, version APIs
- **Security Breaches**: HSM usage, regular audits, insurance
- **Scaling Issues**: Design for 100x growth from day 1 (Market Zero principle)
- **Processor Relationships**: Clear value prop, no direct competition

### Business Risks

- **Processor Pushback**: Focus on SMB/mid-market, not enterprise
- **Slow Adoption**: Strong pilot program, case studies, immediate ROI demonstration
- **Compliance**: Engage legal early, budget for compliance
- **Competition**: Move fast, focus on specific niche
- **Platform Stickiness**: Build habits through daily-use dashboard (Market Zero approach)

---

## Legacy High Priority Items (Evaluate for Orchestration Platform) 🔴

### Professional Invoicing System ✅ COMPLETED

#### Architecture Overview

The new invoicing system separates the concept of **tabs** (quotes/orders) from **invoices** (payment requests). This allows merchants to:

- Create multiple invoices from a single tab
- Invoice for specific items or amounts
- Split bills intelligently for restaurants, hotels, and professional services
- Track payments at the line-item level
- Maintain immutable audit trails

**Key Principle**: Tabs collect items, Invoices request payment for specific items/amounts.

- [x] **Core Invoice Architecture**
  - ✅ Separate invoices from tabs (tabs are quotes, invoices are payment requests)
  - ✅ Immutable invoice records with versioning system
  - ✅ Invoice-to-payment relationship tracking (multiple payments per invoice)
  - ✅ Real-time balance calculation at invoice and line-item level
  - ✅ Audit trail for all invoice state changes

- [x] **Database Schema Updates** ✅ COMPLETED

  ```sql
  -- Enhanced invoice structure
  invoices: {
    id, merchant_id, customer_id, tab_id,
    invoice_number (sequential, unique per merchant),
    status (draft, open, paid, void, uncollectible),
    issue_date, due_date,
    subtotal, tax_amount, total_amount,
    paid_amount, balance,
    payment_terms, notes,
    metadata
  }
  
  -- Invoice line items with payment tracking
  invoice_line_items: {
    id, invoice_id, 
    description, quantity, unit_price,
    line_amount, tax_amount, total_amount,
    allocated_amount, remaining_amount,
    group_id (for grouping items),
    source_line_item_id (from original tab),
    metadata
  }
  
  -- Payment allocation tracking
  invoice_payments: {
    id, invoice_id, payment_id,
    amount, applied_at,
    allocation_method (fifo, proportional, specific),
    line_item_allocations (JSONB)
  }
  
  -- Balance history for audit trail
  balance_history: {
    id, entity_type, entity_id,
    previous_balance, new_balance,
    change_amount, change_reason,
    transaction_id, created_at
  }
  ```

- [x] **Invoice Creation & Management** ✅ COMPLETED
  - ✅ Create invoices from tabs (full or partial)
  - ✅ Select specific line items for invoicing
  - ✅ Split line items across multiple invoices
  - ✅ Set custom amounts per line item
  - ✅ Invoice service with email generation
  - ✅ Public invoice URLs for payment

- [x] **Payment Allocation System** ✅ COMPLETED
  - ✅ FIFO allocation (default - oldest items first)
  - ✅ Proportional allocation (distribute across all items)
  - ✅ Manual allocation (customer/merchant selects items)
  - ✅ Priority-based allocation (tax/fee priority)
  - ✅ Payment reversal for refunds
  - ✅ Partial payment tracking per line item

- [ ] **Invoice Payment Page**
  - [ ] Dedicated payment page per invoice (/pay/invoice/{id})
  - [ ] Show only invoiced items and amounts
  - [ ] Display payment history for the invoice
  - [ ] Support partial payments with clear balance display
  - [ ] Payment method selection (if multiple processors)
  - [ ] Receipt generation after payment

- [ ] **Tab Payment Page Updates**
  - [ ] Show total tab balance (sum of all unpaid invoices)
  - [ ] List all invoices created from the tab
  - [ ] Allow payment of full remaining balance
  - [ ] Show which items have been invoiced
  - [ ] Indicate partially paid items

- [ ] **Split Bill Functionality**
  - [ ] Split invoice by items (select items per person)
  - [ ] Split by percentage (equal or custom percentages)
  - [ ] Split by amount (specify exact amounts)
  - [ ] Group splitting (e.g., appetizers shared, mains individual)
  - [ ] Send split invoices to different emails
  - [ ] Rejoin split invoices if needed

- [ ] **Use Case Implementations**
  - [ ] **Restaurant Mode**:
    - Quick split by seats/covers
    - Item transfer between bills
    - Tip allocation options
    - Kitchen/bar categorization
  - [ ] **Hotel Mode**:
    - Master folio with sub-folios
    - Room charges vs incidentals
    - Direct billing for corporate
    - Deposit handling
  - [ ] **Professional Services**:
    - Milestone-based invoicing
    - Progress billing from estimates
    - Retainer draw-downs
    - Time & materials tracking

- [ ] **Invoice Workflows**
  - [ ] Draft → Open → Paid lifecycle
  - [ ] Void invoices with reason tracking
  - [ ] Credit memo generation for refunds
  - [ ] Invoice amendments (create new version)
  - [ ] Automated payment reminders
  - [ ] Dunning management for overdue

- [ ] **Merchant Controls**
  - [ ] Set default payment terms
  - [ ] Configure allocation methods
  - [ ] Define invoice numbering format
  - [ ] Set up automatic invoicing rules
  - [ ] Manage invoice templates
  - [ ] Configure split bill options

- [ ] **API Enhancements**

  ```typescript
  // New endpoints
  POST   /api/v1/tabs/:id/invoices          // Create invoice from tab
  GET    /api/v1/invoices                   // List invoices
  GET    /api/v1/invoices/:id               // Get invoice details
  PUT    /api/v1/invoices/:id               // Update draft invoice
  POST   /api/v1/invoices/:id/send          // Send invoice
  POST   /api/v1/invoices/:id/void          // Void invoice
  POST   /api/v1/invoices/:id/split         // Split invoice
  POST   /api/v1/invoices/:id/payments      // Record payment
  GET    /api/v1/invoices/:id/payments      // List payments
  DELETE /api/v1/invoices/:id/payments/:pid // Reverse payment
  GET    /api/v1/invoices/:id/history       // Audit trail
  POST   /api/v1/invoices/:id/reminders     // Send reminder
  ```

### Payment Processor Architecture - Merchant-Owned Accounts ✅ COMPLETED

- [x] **Implement Multi-Processor Support Architecture**
  - ✅ Database schema for storing encrypted processor credentials per merchant
  - ✅ Processor abstraction layer/interface for multiple payment providers
  - ✅ Secure credential storage with AES-256-GCM encryption at rest
  - ✅ Processor type enum (stripe, square, paypal, authorize_net)

- [x] **Stripe Connect Alternative Implementation**
  - ✅ Merchant processor settings page in dashboard
  - ✅ Stripe account connection flow (API key input)
  - ✅ Store encrypted Stripe credentials per merchant in database
  - ✅ Updated payment processing to use merchant's Stripe account
  - ✅ Automatic webhook configuration and routing

- [x] **Payment Processor Abstraction Layer**
  - ✅ IPaymentProcessor interface with standard methods:
    - createPaymentIntent(), createCheckoutSession(), handleWebhook(), refund(), getPaymentStatus()
  - ✅ StripeProcessor class implementation
  - ✅ ProcessorFactory to instantiate correct processor
  - ✅ All payment endpoints updated to use abstraction layer

- [x] **Merchant Processor Configuration UI**
  - ✅ "Payment Processors" section in merchant settings
  - ✅ Processor connection wizard with form validation
  - ✅ Connection status and test mode indicators
  - ✅ Ability to activate/deactivate processors
  - ✅ Processor credential validation
  - ✅ Test payment functionality
  - ✅ Real-time webhook status monitoring

- [x] **Security & Compliance - ENHANCED**
  - ✅ Secure credential encryption using AES-256-GCM with authenticated encryption
  - ✅ **Production-grade encryption key management**
  - ✅ **Key versioning for future rotation support**
  - ✅ Never expose credentials in API responses
  - ✅ Comprehensive security test suite (9 security tests)
  - ✅ Development key generation utility
  - ✅ Security audit documentation
  - [ ] Add audit logging for processor configuration changes
  - [ ] Add two-factor authentication for processor changes

- [x] **Database Schema Updates**

  ```sql
  -- merchant_processors table (IMPLEMENTED)
  CREATE TABLE merchant_processors (
    id UUID PRIMARY KEY,
    merchant_id UUID REFERENCES merchants(id),
    processor_type TEXT NOT NULL, -- 'stripe', 'square', 'paypal', 'authorize_net'
    is_active BOOLEAN DEFAULT true,
    is_test_mode BOOLEAN DEFAULT true,
    encrypted_credentials JSONB NOT NULL, -- AES-256-GCM encrypted
    webhook_secret TEXT, -- Auto-generated secure secrets
    metadata JSONB DEFAULT '{}', -- Webhook IDs, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

- [x] **Automatic Webhook Configuration**
  - ✅ Auto-configure webhooks when adding processors
  - ✅ Webhook health monitoring and status indicators
  - ✅ Fallback to manual configuration when needed
  - ✅ Webhook verification and management

- [ ] **Future Payment Processor Support** (Framework Ready)
  - [ ] Square: Complete SquareProcessor implementation
  - [ ] PayPal: Implement PayPalProcessor with Braintree SDK
  - [ ] Authorize.net: Complete implementation
  - ✅ Framework ready for community-contributed processors

### 🔐 **ENHANCED SECURITY IMPLEMENTATION**

**Current Security Level: PRODUCTION-READY** ✅

#### Encryption & Key Management

- **Algorithm**: AES-256-GCM (military-grade, authenticated encryption)
- **Key Management**:
  - Production requires `PAYMENT_PROCESSOR_ENCRYPTION_KEY` environment variable
  - 64-character hex string validation (256-bit entropy)
  - Key generation utility: `node scripts/generate-encryption-key.js`
- **Key Rotation Support**: Version-prefixed encryption for seamless key rotation
- **Backward Compatibility**: Legacy format support during migration

#### Access Control & Data Protection

- **Multi-tenant Isolation**: Row Level Security (RLS) policies
- **API Security**: All endpoints require authenticated merchant sessions
- **Data Masking**: Credentials never exposed in API responses
- **Transport Security**: HTTPS required for all production traffic

#### 🔐 Professional Key Management Solutions (Production Upgrade Path)

**Current Status**: Environment variable-based (✅ Production-ready for most SaaS companies)
**Next Level**: Professional key management services for enterprise compliance

##### AWS KMS (Key Management Service) - Most Popular ⭐ RECOMMENDED

```typescript
// Implementation example for future upgrade:
import { KMSClient, DecryptCommand } from '@aws-sdk/client-kms'

const kms = new KMSClient({ region: 'us-east-1' })

export class KMSEncryptionService {
  static async getDataKey(merchantId: string): Promise<Buffer> {
    const command = new DecryptCommand({
      CiphertextBlob: Buffer.from(process.env.ENCRYPTED_DATA_KEY!, 'base64'),
      EncryptionContext: {
        merchantId,
        purpose: 'payment-credentials'
      }
    })

    const response = await kms.send(command)
    return Buffer.from(response.Plaintext!)
  }
}
```

##### Other Professional Options

- **Azure Key Vault**: Microsoft's key management service
- **Google Cloud KMS**: Google's key management solution
- **HashiCorp Vault**: Self-hosted enterprise solution
- **AWS Secrets Manager**: For automatic secret rotation
- **Hardware Security Modules (HSM)**: Ultimate security level

##### Benefits of Professional Key Management

1. **Automatic Key Rotation** - Keys rotate automatically on schedule
2. **Audit Trails** - Complete logs of who accessed keys when
3. **Geographic Redundancy** - Keys replicated across regions
4. **Compliance Certifications** - SOC 2, FIPS 140-2, Common Criteria
5. **Fine-grained Access Control** - Per-user, per-application permissions
6. **Integration with IAM** - Role-based access management

##### Implementation Priority Roadmap

1. **Current**: Environment variable (✅ Good for MVP/testing)
2. **Next**: AWS KMS integration (🎯 Production-ready for enterprise)
3. **Enterprise**: HSM for ultimate security (🔒 Maximum compliance)

##### When to Upgrade

- **Stick with current**: MVP, early startup, basic SaaS
- **Upgrade to KMS**: Enterprise customers, compliance requirements (PCI DSS Level 1, SOX, HIPAA)
- **Upgrade to HSM**: Financial services, government, ultra-high security requirements

**Security Assessment**: Current implementation is already production-ready for most SaaS companies. The professional key management upgrade is the logical next step for enterprise customers with strict compliance requirements.

#### Security Testing & Compliance

- ✅ **Comprehensive Security Test Suite**: 9 security tests covering:
  - Encryption/decryption validation
  - Key format validation  
  - Tampering detection (authenticated encryption)
  - Never expose credentials in errors
  - Secure random generation
- ✅ **PCI DSS Alignment**: Following requirements 3, 8, 10
- ✅ **GDPR Compliance**: Right to erasure, access logging

#### Implementation Files

- **Core Security**: `/lib/payment-processors/encryption.ts`
- **Key Generation**: `/scripts/generate-encryption-key.js`
- **Security Tests**: `/__tests__/security/encryption.test.ts`
- **Documentation**: `/docs/SECURITY_AUDIT_PAYMENT_CREDENTIALS.md`
- **Environment Setup**: `.env.example` with security guidance

#### Next Security Enhancements (Future)

- [ ] **Professional Key Management Integration**
  - [ ] AWS KMS integration for enterprise customers
  - [ ] Azure Key Vault support
  - [ ] HashiCorp Vault integration  
  - [ ] Hardware Security Module (HSM) support for ultimate security
  - [ ] Automatic key rotation implementation
  - [ ] Cross-region key replication
- [ ] **Enhanced Security Controls**
  - [ ] Audit Logging for all credential access
  - [ ] Two-Factor Authentication for processor management
  - [ ] Rate Limiting on credential operations
  - [ ] Anomaly Detection for suspicious access patterns
  - [ ] Per-merchant encryption context isolation

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

### Unified Organization Architecture ✅ COMPLETED

**Achievement**: Successfully implemented a unified **Organizations** model replacing separate merchants/corporate accounts with a single flexible entity that can have both merchant and corporate capabilities.

**Key Benefits Delivered**:

- ✅ Matches real-world business operations
- ✅ Single team/user management system  
- ✅ Cleaner data model and simpler relationships
- ✅ Better UX with unified organization switching
- ✅ Flexible customer targeting (individual emails OR organizations)

#### Completed Implementation ✅

- [x] **Database Schema Implementation** ✅ COMPLETED
  - ✅ Created organizations table with capability flags (is_merchant, is_corporate)
  - ✅ Created organization_users junction table with roles
  - ✅ Created organization_relationships for B2B credit accounts
  - ✅ Updated all foreign keys to reference organizations
  - ✅ Applied all migration scripts successfully

- [x] **Data Migration Strategy** ✅ COMPLETED
  - ✅ Migrated merchants → organizations (is_merchant=true)
  - ✅ Updated all references in existing tables
  - ✅ Maintained backward compatibility during transition
  - ✅ All migrations applied successfully

- [x] **Service Layer Updates** ✅ COMPLETED
  - ✅ Created OrganizationService for unified management
  - ✅ Updated authentication/authorization to use organizations
  - ✅ Created CustomerTargetingService for flexible email resolution
  - ✅ Updated InvoiceService to use organization-based billing

- [x] **API Refactoring** ✅ COMPLETED
  - ✅ Updated all endpoints to use organization-based auth
  - ✅ Enhanced tabs API for flexible customer targeting
  - ✅ Updated validation schemas for individual/organization customers
  - ✅ Maintained backward compatibility

- [x] **UI/UX Updates** ✅ COMPLETED
  - ✅ Created unified organization switcher component
  - ✅ Updated dashboard layout to use organizations
  - ✅ Fixed registration flow to create organizations
  - ✅ Updated all settings pages for organizations

- [x] **Flexible Customer Targeting** ✅ NEW FEATURE
  - ✅ Tabs can target individual customers (customerEmail) OR organizations (customerOrganizationId)
  - ✅ Smart email resolution: uses org billing email OR customerEmail override
  - ✅ Database schema with proper constraints and validation
  - ✅ CustomerTargetingService with comprehensive test coverage
  - ✅ Updated invoice sending logic for appropriate email resolution

#### Multi-User Team Management 🔴 NEXT HIGH PRIORITY

**Current Status**: Organizations are implemented, but team management within organizations needs enhancement.

**Goal**: Enable multiple users per organization with role-based access control.

##### Implementation Tasks for Morning Priority

- [ ] **Enhanced Team Management UI** 🔴 HIGH PRIORITY
  - [ ] Team members page (/settings/team)
  - [ ] Invite team members with role selection
  - [ ] Role management (owner/admin/member/viewer permissions)
  - [ ] User profile page with organization list
  - [ ] Transfer ownership functionality

- [ ] **Team Invitation System** 🔴 HIGH PRIORITY  
  - [ ] Email invitation system with secure tokens
  - [ ] Invitation acceptance flow
  - [ ] Pending invitations management
  - [ ] Invitation expiry handling (7 days)
  - [ ] Resend invitation functionality

- [ ] **Enhanced Role-Based Permissions** 🟡 MEDIUM PRIORITY

  ```typescript
  enum OrganizationRole {
    OWNER = 'owner',       // Full access, can delete organization
    ADMIN = 'admin',       // Full access except delete organization  
    MEMBER = 'member',     // Create/edit tabs, invoices, view reports
    VIEWER = 'viewer'      // Read-only access to data
  }
  
  // Granular permissions system (future enhancement)
  interface OrganizationPermissions {
    tabs: { create: boolean, edit: boolean, delete: boolean, view: boolean }
    invoices: { create: boolean, send: boolean, void: boolean, view: boolean }
    payments: { process: boolean, refund: boolean, view: boolean }
    settings: { processors: boolean, team: boolean, api_keys: boolean }
    reports: { financial: boolean, analytics: boolean }
  }
  ```

- [ ] **Multi-Organization User Experience** 🟡 MEDIUM PRIORITY
  - [ ] Enhanced organization selection on first login
  - [ ] "Create new organization" workflow  
  - [ ] Multi-organization context switching
  - [ ] X-Organization-ID header support for API

#### Use Cases Now Supported ✅

**Single Organization with Teams**: ✅ WORKING

- ABC Company organization has multiple team members
- Owner: Sarah (full access via organization_users table)
- Members can be added through current organization_users system
- Role-based access working through organization middleware

**Multi-Organization Users**: 🔄 PARTIALLY WORKING

- Users can belong to multiple organizations
- Organization switcher component implemented
- Dashboard shows current organization context
- API authentication works per organization

**Future Enhanced Scenarios**: 🔄 NEEDS TEAM MANAGEMENT UI

- Agency/consultant with multiple client organizations
- Platform with white-label organization creation
- Enterprise with department-based organizations

### API & Backend (Existing Items)

- [ ] **Simplify API Key Strategy for MVP**
  - Consider removing test/live distinction initially
  - Or make test mode behavior more obvious (test payments, etc.)
  - Add environment toggles in dashboard later

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

### Corporate Accounts Architecture ✅ COMPLETED

**Architecture**: B2B customers can have accounts with multiple merchants, maintaining separate relationships while accessing all their data through a unified API.

- [x] **Database Schema for Corporate Accounts**
  - ✅ Created corporate_accounts table with company info
  - ✅ Corporate API keys table for authentication
  - ✅ Corporate-merchant relationships with credit limits
  - ✅ Authorized users table for multi-user access
  - ✅ Activity logging for audit trails

- [x] **Corporate Account Management** ✅ COMPLETED
  - ✅ Service layer for account management
  - ✅ API key generation with secure hashing
  - ✅ Credit limit and payment terms per merchant
  - ✅ Multiple authorized users per account
  - ✅ Discount percentage configuration

- [x] **Tab Integration** ✅ COMPLETED
  - ✅ Link tabs to corporate accounts
  - ✅ Purchase order number tracking
  - ✅ Department/cost center allocation
  - ✅ Corporate account fields in tab schema
  - ✅ Relationship tracking in database

- [x] **Corporate API** ✅ COMPLETED
  - ✅ Dedicated authentication with X-Corporate-API-Key
  - ✅ Corporate middleware for API authentication
  - ✅ Secure key validation and hashing
  - ✅ Test mode support (corp_test_ prefix)
  - ✅ API endpoints documented in QA guide

- [ ] **Corporate Dashboard**
  - [ ] Unified view of all merchant relationships
  - [ ] Tab management across merchants
  - [ ] Spending analytics by merchant/department
  - [ ] User management interface
  - [ ] Invoice consolidation settings

- [x] **Use Case Implementations** ✅ COMPLETED
  - ✅ **Parts Supplier**: Acme Auto Parts test scenario
  - ✅ **Hotel Chain**: Global Hotels with direct billing
  - ✅ **Restaurant Groups**: Bill splitting implementation
  - ✅ **Professional Services**: Milestone-based invoicing

## Legacy Medium Priority Items (Deprioritize) 🟡

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

## Legacy Low Priority Items (Archive) 🟢

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

## Future Platform Considerations 🔮

### Payment Innovation

- [ ] **Cryptocurrency Integration**
  - [ ] Stablecoin payment rails
  - [ ] Cross-border optimization
  - [ ] DeFi yield on float
  - [ ] Smart contract automation

- [ ] **Real-Time Payments**
  - [ ] FedNow integration
  - [ ] RTP network access
  - [ ] Instant settlement
  - [ ] 24/7 processing

- [ ] **Embedded Finance**
  - [ ] Working capital loans
  - [ ] Invoice factoring
  - [ ] Merchant cash advances
  - [ ] Insurance products

### Strategic Partnerships

- [ ] **Banking Partners**
  - [ ] Sponsor bank relationships
  - [ ] Direct processor agreements
  - [ ] Better interchange rates
  - [ ] Custom processing solutions

- [ ] **Technology Partners**
  - [ ] Fraud prevention providers
  - [ ] Identity verification
  - [ ] Business verification
  - [ ] Compliance tools

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

## Performance Optimizations 🚀 (NEW HIGH PRIORITY)

### Database Performance - Critical Optimizations ✅ COMPLETED

- [x] **Fix Security Warnings**
  - ✅ Set search_path to empty string for all SQL functions
  - ✅ Prevents search_path injection attacks
  - ✅ Fixed: update_merchant_processors_updated_at, handle_new_user, update_updated_at_column

- [x] **Optimize RLS Policies**
  - ✅ Replace auth.uid() with (select auth.uid()) to prevent re-evaluation
  - ✅ Combine multiple permissive policies into single policies
  - ✅ Significant query performance improvement at scale

- [x] **Add Performance Indexes**
  - ✅ Foreign key indexes for all relationships
  - ✅ Composite indexes for common query patterns (merchant_id + status)
  - ✅ Partial indexes for frequently filtered data (open/partial tabs)
  - ✅ Date-based indexes for time-series queries
  - ✅ Email index for merchant lookups

- [x] **System-Level Optimizations**
  - ✅ Materialized view for timezone data (cached_timezones)
  - ✅ Optimized get_merchant_stats() function with CTE
  - ✅ Increased statistics targets for join columns
  - ✅ Updated table statistics with ANALYZE

### Application Performance - High Priority

- [ ] **Implement Caching Layer**
  - [ ] Redis/Upstash for API response caching
  - [ ] Cache merchant stats (5-minute TTL)
  - [ ] Cache timezone data in application
  - [ ] Implement cache invalidation strategy
  - [ ] Add ETag support for conditional requests

- [ ] **Connection Pool Optimization**
  - [ ] Use Supabase pooler endpoint for serverless
  - [ ] Configure optimal pool sizes (min: 10, max: 100)
  - [ ] Implement connection retry logic
  - [ ] Monitor connection pool metrics

- [ ] **Query Optimization**
  - [ ] Use specific column selection instead of SELECT *
  - [ ] Implement query batching for related data
  - [ ] Add database views for complex queries
  - [ ] Use prepared statements for repeated queries

- [ ] **API Performance**
  - [ ] Implement request/response compression (gzip/brotli)
  - [ ] Add pagination limits (max 100 items)
  - [ ] Implement cursor-based pagination for large datasets
  - [ ] Add field filtering (?fields=id,name,status)

### Monitoring & Analytics - Medium Priority

- [ ] **Performance Monitoring**
  - [ ] Set up Supabase query performance insights
  - [ ] Configure slow query alerts (>100ms)
  - [ ] Implement APM with OpenTelemetry
  - [ ] Add custom performance metrics

- [ ] **Database Monitoring**
  - [ ] Monitor index usage and effectiveness
  - [ ] Track table bloat and vacuum frequency
  - [ ] Set up connection pool monitoring
  - [ ] Create performance dashboard

### Future Performance Enhancements

- [ ] **Advanced Optimizations**
  - [ ] Implement read replicas for read-heavy operations
  - [ ] Consider table partitioning for large datasets
  - [ ] Add database-level caching (pg_stat_statements)
  - [ ] Implement query result materialization

- [ ] **Edge Computing**
  - [ ] Move compute-intensive operations to Edge Functions
  - [ ] Implement geographic edge caching
  - [ ] Use Deno Deploy for global distribution
  - [ ] Optimize for regional data residency

## Tech Debt 🧹

- [x] **Upgrade Dependencies**
  - ✅ Review and update all npm packages (Dependabot updates applied)
  - ✅ Migrate to latest Next.js features (Next.js 15 compatibility)
  - ✅ Update Stripe SDK (v3.7.0)
  - ✅ Supabase client updates
  - ✅ Zod v4 compatibility fixes
  - ✅ TypeScript strict mode compliance

- [ ] **Test Infrastructure Technical Debt** 🔴 CRITICAL PRIORITY
  - ✅ Fixed major test suite issues (96.6% pass rate achieved, up from ~80%)
  - ✅ Fixed OrganizationService test failures (permission checks, type flags)
  - ✅ Fixed registration test window.location mocking issues
  - ✅ Fixed settings flow clipboard API testing approach  
  - ✅ Fixed webhooks test mockConstructEvent hoisting errors
  - [ ] **Remaining Database Mock Issues**:

    ```typescript
    // These patterns need proper mocking:
    db.update(payments).set({}).where(eq()).returning()  // ❌ .returning not a function
    db.transaction(async (tx) => { ... })              // ❌ transaction callback structure  
    db.query.tabs.findFirst({ where: ... })           // ❌ response format mismatch
    ```

  - [ ] **API Route Export Issues**:
    - PUT handler not exported in `/api/v1/tabs/[id]/route.ts`
    - Import path mismatches in test files
    - Missing error boundary handling

- [ ] **Test Coverage**
  - ✅ Core unit tests passing (672/697 tests, 96.6% pass rate)
  - ✅ Security test suite (9 tests passing)
  - [ ] Fix remaining 24 failing tests (database mocks, imports, error formats)
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

## Completed Foundation Work ✅

### Test Infrastructure Recovery ✅ (January 2025)

- [x] **Major Test Suite Stabilization**
  - **Achievement**: Improved from ~80% to 96.6% test pass rate (672/697 tests passing)
  - Fixed OrganizationService test failures (permission checks, type flags, error handling)
  - Fixed tabs CRUD API test response structure expectations  
  - Fixed registration test window.location mocking issues
  - Fixed settings flow clipboard API testing approach
  - Fixed webhooks test mockConstructEvent hoisting errors
  - Resolved Jest mock hoisting issues and JSDOM navigation limitations
  - **Result**: Only 24 failing tests remaining, down from 100+ failures

### Multi-Processor Architecture Foundation ✅

- [x] **Payment Processor Abstraction Layer** (January 2025)
  - Secure credential storage with AES-256-GCM encryption
  - IPaymentProcessor interface design
  - StripeProcessor full implementation
  - ProcessorFactory for dynamic instantiation
  - Multi-tenant isolation with RLS

- [x] **Security Infrastructure** (January 2025)
  - Production-grade encryption for credentials
  - Key versioning for rotation support
  - Comprehensive security test suite
  - PCI DSS alignment started
  - Audit logging framework

- [x] **Database Architecture** (January 2025)
  - Unified organization model
  - Flexible customer targeting
  - Performance optimizations
  - Multi-processor schema
  - Team management structure

### Legacy Platform Features ✅

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

- [x] **Unified Organization Architecture (January 2025)** ✅ MAJOR MILESTONE
  - Replaced separate merchants/corporate accounts with unified organizations
  - Implemented flexible customer targeting (individuals OR organizations)
  - Created CustomerTargetingService for smart email resolution
  - Updated all APIs, services, and UI to use organizations
  - Maintained backward compatibility throughout migration
  - 379 tests passing including new customer targeting tests
  - Database migrations applied successfully
  - Organization switcher and dashboard updates complete
