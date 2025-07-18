# Payment Flow Integration Tests

This directory contains integration tests for the Tab payment platform's payment flows.

## Working Test Coverage

### `payment-flow-final.test.ts` ✅ 
The main working integration test file that covers:
- **Tab Creation and Calculations**: Tax calculations, totals
- **Payment Intent Creation**: Amount validation, currency conversion
- **Webhook Event Processing**: Payment success, status updates
- **Refund Processing**: Full and partial refunds
- **Currency Handling**: Regular and zero-decimal currencies
- **Concurrent Operations**: Multiple payment handling
- **Error Scenarios**: Payment failures, disputes

## Running the Tests

```bash
# Run all integration tests
npm test -- __tests__/integration

# Run specific test file
npm test -- payment-flow.test.ts

# Run with coverage
npm run test:coverage -- __tests__/integration

# Run in watch mode
npm run test:watch -- __tests__/integration
```

## Test Structure

All tests use Jest with mocked dependencies:
- **Stripe SDK**: Mocked using helper functions in `__tests__/helpers/stripe-mock.ts`
- **Database**: Mocked at the client level to simulate database operations
- **HTTP Requests**: Using Next.js `NextRequest` for realistic request handling

## Key Testing Patterns

1. **Mocking Stripe**: The `setupStripeMocks()` helper provides consistent Stripe API mocks
2. **Database Transactions**: Transaction mocks simulate atomic operations
3. **Authentication**: API key validation is mocked for authenticated endpoints
4. **Webhook Security**: Signature verification is mocked but follows the same pattern as production

## Adding New Tests

When adding new payment-related features:

1. Add unit tests for individual functions in `lib/services/__tests__/`
2. Add integration tests here for complete flows
3. Mock external dependencies (Stripe, database) appropriately
4. Test both success and failure scenarios
5. Include edge cases and concurrent operations

## Important Notes

- These tests use mocked Stripe responses - for full E2E testing, use Stripe's test mode
- Database mocks simulate the behavior but don't test actual SQL queries
- Webhook signature verification is mocked - production uses actual Stripe signatures
- All monetary amounts in tests use the same format as production (string decimals)