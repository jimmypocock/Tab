# Tab Application Testing Guide

This project uses a comprehensive testing strategy with multiple testing tools and approaches.

## Testing Stack

- **Jest** - Unit and integration testing
- **React Testing Library** - Component testing
- **next-test-api-route-handler** - API route testing
- **Playwright** - End-to-end testing

## Test Structure

```
__tests__/
├── api/                  # API route tests
│   ├── tabs.test.ts     # Tab CRUD operations
│   ├── webhooks.test.ts # Stripe webhook handling
│   └── public-payment.test.ts # Public payment endpoints
├── components/          # UI component tests
│   ├── payment-form.test.tsx
│   └── tabs-list.test.tsx
└── integration/         # Integration tests
    └── payment-flow-final.test.ts

e2e/                     # End-to-end tests
└── payment-flow.spec.ts # Complete payment flow scenarios
```

## Running Tests

### All Tests
```bash
npm test                 # Run all tests
npm run test:watch      # Run tests in watch mode
npm run test:coverage   # Run tests with coverage report
```

### Specific Test Types
```bash
npm run test:api        # Test API routes only
npm run test:components # Test React components only
npm run test:integration # Test integration scenarios
```

### End-to-End Tests
```bash
npm run test:e2e        # Run Playwright E2E tests
npm run test:e2e:ui     # Open Playwright UI mode
npm run test:e2e:debug  # Run tests in debug mode
```

## Test Coverage Areas

### API Route Tests (`__tests__/api/`)
- ✅ Authentication and authorization
- ✅ Tab creation with calculations
- ✅ Payment intent creation
- ✅ Webhook signature verification
- ✅ Error handling and validation
- ✅ Public payment endpoints

### Component Tests (`__tests__/components/`)
- ✅ Payment form interactions
- ✅ Stripe Elements integration
- ✅ Tab list filtering and search
- ✅ Error states and loading states
- ✅ Responsive design

### Integration Tests (`__tests__/integration/`)
- ✅ Complete payment flow logic
- ✅ Tax calculations
- ✅ Currency handling
- ✅ Refund processing
- ✅ Concurrent operations

### E2E Tests (`e2e/`)
- ✅ Full payment journey
- ✅ Partial payments
- ✅ Payment validation
- ✅ Mobile responsiveness
- ✅ Merchant dashboard operations

## Testing Best Practices

### API Route Testing
Tests use `@jest-environment node` directive to run in Node environment:
```javascript
/**
 * @jest-environment node
 */
```

### Component Testing
- Mock external dependencies (Stripe, fetch)
- Test user interactions with `@testing-library/user-event`
- Verify accessibility with semantic queries

### E2E Testing
- Uses real browser automation
- Tests complete user journeys
- Includes mobile viewport testing
- Handles async operations properly

## Mocking Strategies

### Stripe Mocking
```javascript
jest.mock('@stripe/stripe-js', () => ({
  loadStripe: jest.fn(() => Promise.resolve({
    elements: jest.fn(),
    createPaymentMethod: jest.fn(),
  })),
}))
```

### Database Mocking
Database operations are mocked at the client level to test business logic without real database connections.

### API Mocking
The `next-test-api-route-handler` package allows testing Next.js API routes with proper request/response handling.

## Coverage Goals

- Unit tests: >80% coverage
- Integration tests: Critical business flows
- E2E tests: Happy paths and key error scenarios

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Push to main branch
- Pre-deployment checks

## Debugging Tests

### Jest Tests
```bash
# Run specific test file
npm test -- tabs.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should create tab"

# Debug in VS Code
# Add breakpoint and use "Jest: Debug" launch config
```

### Playwright Tests
```bash
# Run headed (see browser)
npx playwright test --headed

# Run specific test
npx playwright test payment-flow.spec.ts

# Generate test code
npx playwright codegen localhost:1235
```

## Common Issues

### "Cannot find module" errors
- Ensure TypeScript paths are configured in both `tsconfig.json` and `jest.config.ts`

### Stripe iframe issues in tests
- Use proper Stripe test keys
- Mock Stripe Elements for unit tests
- Use real Stripe test mode for E2E tests

### Async test timeouts
- Increase timeout for long operations:
  ```javascript
  test('long operation', async () => {
    // test code
  }, 30000) // 30 second timeout
  ```