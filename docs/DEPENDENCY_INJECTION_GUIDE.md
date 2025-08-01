# Dependency Injection Guide

This guide explains how to use the new Dependency Injection (DI) pattern in the Tab application.

## Overview

The DI pattern helps us:
- Write more testable code
- Manage dependencies cleanly
- Switch implementations easily (e.g., different payment providers)
- Enable feature flags for gradual rollouts

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│   API Routes    │────▶│   Services   │────▶│ Repositories │
└─────────────────┘     └──────────────┘     └──────────────┘
         │                       │                     │
         └───────────────────────┴─────────────────────┘
                                 │
                         ┌───────▼────────┐
                         │  DI Container  │
                         └────────────────┘
```

## Quick Start

### 1. Using Services in Routes

```typescript
import { getDI, DITokens } from '@/lib/di'
import { TabManagementService } from '@/lib/services/tab-management.service'

export async function GET(request: NextRequest) {
  return withOrganizationAuth(request, async (req, context) => {
    // Get service from DI container
    const container = getDI()
    const tabService = container.resolve<TabManagementService>(DITokens.TabService)
    
    // Use service
    const result = await tabService.listTabs(context.organizationId, {
      page: 1,
      pageSize: 20
    })
    
    return NextResponse.json(result)
  })
}
```

### 2. Creating a New Repository

```typescript
// lib/repositories/my-entity.repository.ts
import { BaseRepository } from './base.repository'
import { myEntityTable } from '@/lib/db/schema'

export class MyEntityRepository extends BaseRepository {
  readonly name = 'MyEntityRepository'
  
  async findById(id: string): Promise<MyEntity | null> {
    return this.db.query.myEntity.findFirst({
      where: eq(myEntityTable.id, id)
    })
  }
  
  async create(data: CreateMyEntityInput): Promise<MyEntity> {
    const [created] = await this.db
      .insert(myEntityTable)
      .values(data)
      .returning()
    
    return created
  }
}
```

### 3. Creating a New Service

```typescript
// lib/services/my-entity.service.ts
import { DITokens } from '@/lib/di/types'
import type { IDIContainer } from '@/lib/di/types'

export class MyEntityService {
  private repo: MyEntityRepository
  private emailService: EmailService
  
  constructor(container: IDIContainer) {
    this.repo = container.resolve(DITokens.MyEntityRepository)
    this.emailService = container.resolve(DITokens.EmailService)
  }
  
  async createEntity(data: CreateEntityInput): Promise<MyEntity> {
    // Business logic
    const entity = await this.repo.create(data)
    
    // Send notification
    await this.emailService.send({
      to: data.email,
      subject: 'Entity Created',
      text: `Your entity ${entity.id} has been created.`
    })
    
    return entity
  }
}
```

### 4. Registering Dependencies

Add to `lib/di/config.ts`:

```typescript
export const productionConfig: DependencyConfig[] = [
  // ... existing config
  
  // Register repository
  {
    token: DITokens.MyEntityRepository,
    factory: (container) => new MyEntityRepository(
      container.resolve(DITokens.Database)
    ),
    singleton: true,
  },
  
  // Register service
  {
    token: DITokens.MyEntityService,
    factory: (container) => new MyEntityService(container),
    singleton: false, // New instance per request
  },
]
```

## Testing with DI

### 1. Unit Testing Services

```typescript
describe('MyEntityService', () => {
  let container: IDIContainer
  let service: MyEntityService
  let mockRepo: jest.Mocked<MyEntityRepository>
  
  beforeEach(() => {
    // Initialize test container
    resetDI()
    initializeDI('test')
    
    container = getDI()
    service = container.resolve(DITokens.MyEntityService)
    
    // Get mocked dependencies
    const mockDb = container.resolve(DITokens.Database)
    mockDb.query.myEntity.findFirst.mockResolvedValue(null)
  })
  
  it('should create entity', async () => {
    const mockEntity = { id: '123', name: 'Test' }
    mockDb.insert.mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([mockEntity])
      })
    })
    
    const result = await service.createEntity({ name: 'Test' })
    expect(result).toEqual(mockEntity)
  })
})
```

### 2. Integration Testing

```typescript
describe('API Integration', () => {
  it('should create tab via API', async () => {
    const request = new NextRequest('http://localhost/api/v1/tabs', {
      method: 'POST',
      headers: {
        'x-api-key': 'test_key',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        customerName: 'Test',
        lineItems: [{ description: 'Item', quantity: 1, unitPrice: 10 }]
      })
    })
    
    const response = await POST(request)
    expect(response.status).toBe(201)
  })
})
```

## Feature Flags

### 1. Enable DI Pattern Gradually

```typescript
const featureFlags = container.resolve<FeatureFlagService>(DITokens.FeatureFlags)

const useDI = await featureFlags.isEnabled(
  FeatureFlagService.FLAGS.USE_DI_PATTERN,
  { organizationId: context.organizationId }
)

if (useDI) {
  // Use new DI implementation
  return tabService.listTabs(...)
} else {
  // Use existing implementation
  return db.query.tabs.findMany(...)
}
```

### 2. Managing Feature Flags

```typescript
// Enable for specific organization
await featureFlags.setFlag({
  key: FeatureFlagService.FLAGS.USE_DI_PATTERN,
  enabled: true,
  enabledForOrgs: ['org_123', 'org_456']
})

// Enable for percentage of users
await featureFlags.setFlag({
  key: FeatureFlagService.FLAGS.USE_DI_PATTERN,
  enabled: true,
  rolloutPercentage: 10 // 10% of users
})
```

## Best Practices

1. **Keep repositories focused on data access**
   - No business logic
   - Simple CRUD operations
   - Return domain models

2. **Services contain business logic**
   - Orchestrate multiple repositories
   - Handle transactions
   - Enforce business rules

3. **Use dependency tokens**
   - Type-safe dependency resolution
   - Easy to refactor
   - Clear dependencies

4. **Scope appropriately**
   - Repositories: Singleton (stateless)
   - Services: Request-scoped (may have state)
   - Clients: Singleton (connection pooling)

5. **Test at the right level**
   - Unit test services with mocked repositories
   - Integration test with real database (PGlite)
   - E2E test through API routes

## Migration Strategy

1. **Phase 1**: New features use DI pattern
2. **Phase 2**: High-value routes (payments, tabs) migrated
3. **Phase 3**: Gradual migration of remaining routes
4. **Phase 4**: Remove old patterns

Use feature flags to control rollout and rollback if needed.

## Common Patterns

### Request Context

```typescript
export class RequestContext {
  constructor(
    private container: IDIContainer,
    private organizationId: string,
    private userId?: string
  ) {}
  
  get tabService() {
    return new TabService(this.container, this.organizationId)
  }
}
```

### Transactions

```typescript
class MyService {
  async complexOperation() {
    return this.repo.transaction(async (tx) => {
      const entity = await tx.insert(...)
      const related = await tx.insert(...)
      return { entity, related }
    })
  }
}
```

### Caching

```typescript
class CachedRepository extends BaseRepository {
  private cache: Map<string, any> = new Map()
  
  async findById(id: string) {
    if (this.cache.has(id)) {
      return this.cache.get(id)
    }
    
    const result = await super.findById(id)
    if (result) {
      this.cache.set(id, result)
    }
    return result
  }
}
```