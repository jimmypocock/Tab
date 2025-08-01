# Testing Strategy Summary - Drizzle ORM

## Current Situation

After extensive investigation, here's what we found:

### 1. **The Core Problem**
- The API routes use Drizzle's relational query API: `db.query.table.findMany()`
- This is different from the query builder API: `db.select().from().where()`
- Mocking the relational API is complex due to nested `with` clauses and dynamic filtering

### 2. **Why Tests Are Failing**
- The route handlers are returning `undefined` because the middleware isn't properly initialized
- Database mocks don't match the actual Drizzle API structure
- Transaction mocking is particularly tricky with Drizzle

### 3. **Available Testing Solutions**

#### Option 1: **In-Memory PostgreSQL (PGlite)** ✅ RECOMMENDED
```bash
npm install --save-dev @electric-sql/pglite
```

**Pros:**
- Real PostgreSQL in WASM
- No mocking needed
- Catches actual SQL issues
- Fast (in-memory)

**Cons:**
- Requires migration setup
- Slightly slower than mocks

#### Option 2: **Drizzle Factory** 
```bash
npm install --save-dev @praha/drizzle-factory
```

**Pros:**
- Simplifies test data generation
- Works with real or mock database

#### Option 3: **Fix Current Mocking**
Use the helpers we created:
- `drizzle-mock.ts` - Comprehensive Drizzle mock
- `db-mock.ts` - Query builder mock

**Pros:**
- Fastest execution
- No external dependencies

**Cons:**
- Complex to maintain
- May miss real SQL issues

## Recommended Approach

### 1. **Short Term: Fix Existing Tests**
The existing tests in `__tests__/api/tabs.test.ts` show a working pattern:

```typescript
// They mock at the query level, not the db level
mockDb.query.tabs.findMany.mockResolvedValue([...])

// They use transactions properly
mockDb.transaction.mockImplementation(async (callback) => {
  const tx = { /* mock tx methods */ }
  return callback(tx)
})
```

### 2. **Medium Term: Use PGlite for Integration Tests**
```typescript
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'

beforeEach(async () => {
  const client = new PGlite()
  const db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder: './drizzle' })
})
```

### 3. **Long Term: Testing Strategy**
- **Unit Tests**: Mock at service level, not database
- **Integration Tests**: Use PGlite
- **E2E Tests**: Use real test database

## Action Items

1. **Fix the 79 failing tests** by:
   - Using the existing mock pattern from working tests
   - Mocking `db.query.table.findMany()` not `db.select()`
   - Properly mocking transactions

2. **Create test utilities**:
   - Database seeding helpers
   - Request/response validators
   - Common test scenarios

3. **Document testing patterns**:
   - How to mock Drizzle queries
   - How to test transactions
   - How to test with relations

## Example of Working Test Pattern

```typescript
// Mock the relational query API
mockDb.query.tabs.findMany.mockResolvedValue([
  {
    id: 'tab_1',
    // ... tab fields
    lineItems: [], // Relations are included
    payments: [],
    customerOrganization: null
  }
])

// Mock transactions
mockDb.transaction.mockImplementation(async (callback) => {
  const txMock = {
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([result])
      })
    }),
    query: {
      tabs: {
        findFirst: jest.fn().mockResolvedValue(result)
      }
    }
  }
  return callback(txMock)
})
```

## Conclusion

The best path forward is to:
1. Fix existing tests using the patterns that work
2. Gradually introduce PGlite for better integration testing
3. Focus on testing business logic, not ORM internals