import { createNewApiKey, deleteApiKey } from '@/app/(dashboard)/settings/actions'
import { generateApiKey, hashApiKey } from '@/lib/utils/api-keys'
import { db } from '@/lib/db/client'
import { apiKeys } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

// Mock database
jest.mock('@/lib/db/client', () => ({
  db: {
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn(),
    delete: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    query: {
      apiKeys: {
        findMany: jest.fn(),
      },
    },
  },
}))

// Mock Supabase auth
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: {
          user: {
            id: 'test-user-id',
          },
        },
        error: null,
      }),
    },
  })),
}))

describe('API Key Management', () => {
  const mockUserId = 'test-user-id'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('generateApiKey', () => {
    it('should generate a valid API key', () => {
      const key = generateApiKey()
      
      expect(key).toMatch(/^tab_(live|test)_[a-zA-Z0-9]{32}$/)
      expect(key.length).toBe(41) // prefix (8) + underscore (1) + random (32)
    })

    it('should generate unique keys', () => {
      const keys = new Set()
      for (let i = 0; i < 100; i++) {
        keys.add(generateApiKey())
      }
      
      expect(keys.size).toBe(100) // All keys should be unique
    })
  })

  describe('hashApiKey', () => {
    it('should create consistent hashes', async () => {
      const key = 'tab_test_12345678901234567890123456789012'
      const hash1 = await hashApiKey(key)
      const hash2 = await hashApiKey(key)
      
      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64) // SHA-256 hex string
    })

    it('should create different hashes for different keys', async () => {
      const key1 = 'tab_test_12345678901234567890123456789012'
      const key2 = 'tab_test_98765432109876543210987654321098'
      
      const hash1 = await hashApiKey(key1)
      const hash2 = await hashApiKey(key2)
      
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('createNewApiKey', () => {
    it('should create a new API key with custom name', async () => {
      const mockApiKey = {
        id: uuidv4(),
        name: 'Production Key',
        key_hash: 'mock_hash',
        created_at: new Date(),
      }

      ;(db.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockApiKey]),
        }),
      })

      const result = await createNewApiKey('Production Key')

      expect(result.success).toBe(true)
      expect(result.apiKey).toMatch(/^tab_(live|test)_[a-zA-Z0-9]{32}$/)
      expect(result.keyName).toBe('Production Key')
      
      // Verify database insert was called
      expect(db.insert).toHaveBeenCalledWith(apiKeys)
      expect(db.values).toHaveBeenCalledWith({
        merchantId: mockUserId,
        name: 'Production Key',
        keyHash: expect.any(String),
      })
    })

    it('should generate default name if not provided', async () => {
      const mockApiKey = {
        id: uuidv4(),
        name: expect.stringMatching(/^API Key \d{4}-\d{2}-\d{2}$/),
        key_hash: 'mock_hash',
        created_at: new Date(),
      }

      ;(db.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockApiKey]),
        }),
      })

      const result = await createNewApiKey('')

      expect(result.success).toBe(true)
      expect(result.keyName).toMatch(/^API Key \d{4}-\d{2}-\d{2}$/)
    })

    it('should handle database errors gracefully', async () => {
      ;(db.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockRejectedValue(new Error('Database error')),
        }),
      })

      const result = await createNewApiKey('Test Key')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to create API key')
    })

    it('should retry on duplicate key hash', async () => {
      let callCount = 0
      ;(db.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockImplementation(() => {
            callCount++
            if (callCount === 1) {
              // First attempt fails with duplicate key
              const error = new Error('Duplicate key')
              ;(error as any).code = '23505'
              return Promise.reject(error)
            } else {
              // Second attempt succeeds
              return Promise.resolve([{
                id: uuidv4(),
                name: 'Test Key',
                key_hash: 'mock_hash',
                created_at: new Date(),
              }])
            }
          }),
        }),
      })

      const result = await createNewApiKey('Test Key')

      expect(result.success).toBe(true)
      expect(callCount).toBe(2) // Should have retried once
    })
  })

  describe('deleteApiKey', () => {
    it('should delete an API key', async () => {
      const keyId = uuidv4()
      
      ;(db.delete as jest.Mock).mockReturnValue({
        where: jest.fn().mockResolvedValue({ rowCount: 1 }),
      })

      const result = await deleteApiKey(keyId)

      expect(result.success).toBe(true)
      expect(db.delete).toHaveBeenCalledWith(apiKeys)
      expect(db.where).toHaveBeenCalledWith(
        expect.objectContaining({
          sql: expect.stringContaining('AND'),
        })
      )
    })

    it('should handle deletion errors', async () => {
      ;(db.delete as jest.Mock).mockReturnValue({
        where: jest.fn().mockRejectedValue(new Error('Database error')),
      })

      const result = await deleteApiKey(uuidv4())

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to delete API key')
    })
  })
})

describe('API Key Validation', () => {
  it('should validate API key format', () => {
    const validKeys = [
      'tab_live_12345678901234567890123456789012',
      'tab_test_abcdefghijklmnopqrstuvwxyz123456',
    ]

    const invalidKeys = [
      'tab_prod_12345678901234567890123456789012', // Invalid environment
      'tab_live_123', // Too short
      'tab_live_123456789012345678901234567890123', // Too long
      'invalid_key_format',
      '',
      null,
    ]

    validKeys.forEach(key => {
      expect(key).toMatch(/^tab_(live|test)_[a-zA-Z0-9]{32}$/)
    })

    invalidKeys.forEach(key => {
      expect(key).not.toMatch(/^tab_(live|test)_[a-zA-Z0-9]{32}$/)
    })
  })
})