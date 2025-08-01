# Jest Mocking Solution for Drizzle ORM

## The Problem

The tests are failing because Jest cannot properly mock the `db` object from '@/lib/db/client' when it's imported in the route files. Specifically:

```typescript
// In route file
import { db } from '@/lib/db/client'

// Later in code
const results = await db.query.tabs.findMany({ ... })
// This fails because db.query is undefined in tests
```

## Why It's Happening

1. Jest hoists `jest.mock()` calls to the top of the file
2. But the module system has already resolved the imports
3. The route file gets the real `db` object, not our mock
4. When we try to mock it, the route has already captured the original reference

## Solutions

### Solution 1: Manual Mocking (Recommended for now)

Create a manual mock file:

```typescript
// __mocks__/@/lib/db/client.ts
export const db = {
  query: {
    tabs: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    // ... other tables
  },
  transaction: jest.fn(),
  // ... other methods
}
```

### Solution 2: Service Layer Pattern

Instead of mocking the database directly, create service classes:

```typescript
// lib/services/tab.service.ts
export class TabService {
  static async findMany(organizationId: string, filters: any) {
    return db.query.tabs.findMany({ ... })
  }
}

// In tests
jest.mock('@/lib/services/tab.service')
```

### Solution 3: Dependency Injection

Pass the database as a parameter:

```typescript
// In route
export async function GET(request: NextRequest, deps = { db }) {
  const results = await deps.db.query.tabs.findMany({ ... })
}

// In tests
const mockDb = { ... }
await GET(request, { db: mockDb })
```

## Immediate Fix

For the failing tests, the quickest fix is to:

1. Create `__mocks__` directory structure
2. Add manual mocks for database client
3. Ensure mocks are loaded before route imports

This is why some tests in the codebase work - they're using the correct mocking pattern.