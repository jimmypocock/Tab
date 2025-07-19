# Testing Infrastructure

This directory contains the testing infrastructure for the Tab application, including test utilities, mocks, and example tests.

## Structure

```
__tests__/
├── api/                    # API route tests
├── components/            # Component tests
├── dashboard/             # Dashboard-specific tests
├── examples/              # Example tests demonstrating utilities
├── helpers/               # Test utilities and helpers
│   ├── test-utils.tsx     # Custom render with providers
│   ├── supabase-mock.ts   # Supabase mocking utilities
│   └── stripe-checkout-mock.ts # Stripe Checkout mocks
├── mocks/                 # MSW handlers and server setup
│   ├── handlers.ts        # API endpoint handlers
│   ├── server.ts          # Node.js server setup
│   └── browser.ts         # Browser worker setup
└── __mocks__/             # Module mocks
    ├── fileMock.js        # Static file mock
    └── stripe.ts          # Stripe module mock
```

## Key Features

### 1. Custom Test Render (`test-utils.tsx`)

The custom render function wraps components with all necessary providers:
- React Query for data fetching
- Next.js Router context
- Theme provider (ready for future use)

```tsx
import { render, screen, getUser } from '@/tests/helpers/test-utils'

// Basic usage
render(<MyComponent />)

// With custom router
render(<MyComponent />, {
  router: {
    pathname: '/dashboard',
    query: { id: '123' }
  }
})

// With custom query client
render(<MyComponent />, {
  queryClient: customQueryClient
})
```

### 2. Mock Service Worker (MSW)

MSW provides realistic API mocking by intercepting network requests:

```tsx
import { server } from '@/tests/mocks/server'
import { http, HttpResponse } from 'msw'

// Override handler for specific test
server.use(
  http.get('/api/v1/tabs', () => {
    return HttpResponse.json({ data: customData })
  })
)
```

### 3. Supabase Mocking

Comprehensive Supabase client mocking with chainable query builders:

```tsx
import { createSupabaseMock } from '@/tests/helpers/supabase-mock'

const supabase = createSupabaseMock({
  data: {
    tabs: [{ id: '1', name: 'Test Tab' }]
  },
  auth: {
    user: { id: 'user_123', email: 'test@example.com' }
  }
})
```

### 4. Stripe Checkout Mocking

Testing utilities for Stripe Checkout integration:

```tsx
import { createCheckoutSession, mockCheckoutFlow } from '@/tests/helpers/stripe-checkout-mock'

// Mock checkout session
const session = createCheckoutSession({
  id: 'cs_test_123',
  amount_total: 10000,
  customer_email: 'test@example.com'
})

// Mock redirect behavior
mockCheckoutFlow.mockRedirect('https://checkout.stripe.com/test')
```

## Common Testing Patterns

### Testing Components with API Calls

```tsx
import { render, screen, waitFor, mockApiResponse } from '@/tests/helpers/test-utils'

it('fetches and displays data', async () => {
  // Mock API response
  mockApiResponse('/api/v1/tabs', {
    data: [{ id: '1', customerName: 'John Doe' }]
  })

  render(<TabsList />)

  // Wait for data to load
  await waitFor(() => {
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })
})
```

### Testing User Interactions

```tsx
import { render, screen, getUser } from '@/tests/helpers/test-utils'

it('handles form submission', async () => {
  const user = getUser()
  render(<CreateTabForm />)

  // Fill form
  await user.type(screen.getByLabelText('Customer Name'), 'Jane Smith')
  await user.type(screen.getByLabelText('Amount'), '100.00')

  // Submit
  await user.click(screen.getByRole('button', { name: 'Create Tab' }))

  // Check result
  await waitFor(() => {
    expect(screen.getByText('Tab created successfully')).toBeInTheDocument()
  })
})
```

### Testing Responsive Behavior

```tsx
import { render, screen, viewports } from '@/tests/helpers/test-utils'

it('shows mobile navigation on small screens', () => {
  viewports.mobile()
  render(<Navigation />)
  
  expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument()
})
```

### Testing Error States

```tsx
import { server } from '@/tests/mocks/server'
import { http, HttpResponse } from 'msw'

it('handles API errors', async () => {
  server.use(
    http.get('/api/v1/tabs', () => {
      return HttpResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      )
    })
  )

  render(<TabsList />)

  await waitFor(() => {
    expect(screen.getByText(/error loading tabs/i)).toBeInTheDocument()
  })
})
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test payment-link-button.test.tsx
```

## Best Practices

1. **Use Custom Render**: Always use the custom render from `test-utils.tsx` instead of the default RTL render.

2. **Mock at the Network Level**: Use MSW for API mocking instead of mocking fetch directly.

3. **Test User Behavior**: Test what users see and do, not implementation details.

4. **Use Data Attributes for Testing**: Add `data-testid` attributes for elements that are hard to query semantically.

5. **Keep Tests Isolated**: Each test should be independent and not rely on the state from other tests.

6. **Use Realistic Data**: Mock data should resemble production data as closely as possible.

7. **Test Accessibility**: Use `checkA11y` helper to ensure components are accessible.

## Troubleshooting

### "Cannot find module" errors
- Ensure import paths are correct (use relative paths in test files)
- Check that the module is properly mocked in `__mocks__` directory

### MSW not intercepting requests
- Ensure MSW server is imported in your test file
- Check that the request URL matches the handler pattern
- Verify that fetch is available (polyfilled in jest.setup.ts)

### Clipboard API not working
- Use `fireEvent.click` instead of `userEvent.click` for clipboard operations
- The clipboard mock is set up in individual test files

### React Query not updating
- Ensure you're using `waitFor` for async state updates
- Check that the query key matches between component and test
- Use `retry: false` in test query client configuration