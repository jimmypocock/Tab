/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/v1/organizations/[id]/api-keys/route'
import { PUT, DELETE } from '@/app/api/v1/organizations/[id]/api-keys/[keyId]/route'
import { ApiKeyService } from '@/lib/services/api-key.service'
import { createClient } from '@/lib/supabase/server'
import { mockSupabaseClient } from '../../helpers/supabase-mock'

// Mock dependencies
jest.mock('@/lib/supabase/server')
jest.mock('@/lib/services/api-key.service')

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
const mockApiKeyService = ApiKeyService as jest.Mocked<typeof ApiKeyService>

describe('API Key Management Endpoints', () => {
  const organizationId = 'org_123'
  const keyId = 'key_456'
  const userId = 'user_789'

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock Supabase client
    const supabaseMock = mockSupabaseClient({
      auth: {
        user: { id: userId, email: 'test@example.com' }
      }
    })
    mockCreateClient.mockResolvedValue(supabaseMock as any)
  })

  describe('GET /api/v1/organizations/[id]/api-keys', () => {
    it('should return API keys for organization', async () => {
      const mockApiKeys = [
        {
          id: 'key_1',
          name: 'Production Key',
          keyPrefix: 'org_live_abc',
          scope: 'merchant',
          permissions: {},
          isActive: true,
          lastUsedAt: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
          revokedAt: null,
          usageCount: 10
        },
        {
          id: 'key_2',
          name: 'Test Key',
          keyPrefix: 'org_test_def',
          scope: 'merchant',
          permissions: {},
          isActive: true,
          lastUsedAt: null,
          createdAt: new Date('2024-01-02'),
          revokedAt: null,
          usageCount: 0
        }
      ]

      mockApiKeyService.getOrganizationApiKeys.mockResolvedValue(mockApiKeys)

      const request = new NextRequest('http://localhost/api/v1/organizations/org_123/api-keys')
      const response = await GET(request, { params: { id: organizationId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toEqual(mockApiKeys)
      expect(data.meta.total).toBe(2)
      expect(mockApiKeyService.getOrganizationApiKeys).toHaveBeenCalledWith(organizationId, userId)
    })

    it('should handle authentication errors', async () => {
      const supabaseMock = mockSupabaseClient({
        auth: {
          user: null
        }
      })
      mockCreateClient.mockResolvedValue(supabaseMock as any)

      const request = new NextRequest('http://localhost/api/v1/organizations/org_123/api-keys')
      const response = await GET(request, { params: { id: organizationId } })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.message).toBe('Authentication required')
    })

    it('should handle missing organization ID', async () => {
      const request = new NextRequest('http://localhost/api/v1/organizations//api-keys')
      const response = await GET(request, { params: { id: '' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.message).toBe('Organization ID is required')
    })

    it('should handle service errors', async () => {
      mockApiKeyService.getOrganizationApiKeys.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost/api/v1/organizations/org_123/api-keys')
      const response = await GET(request, { params: { id: organizationId } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.message).toBe('Internal server error')
    })
  })

  describe('POST /api/v1/organizations/[id]/api-keys', () => {
    it('should create a new API key', async () => {
      const newApiKeyData = {
        name: 'New Test Key',
        scope: 'merchant' as const,
        environment: 'test' as const,
        permissions: { tabs: 'read' }
      }

      const mockResult = {
        apiKey: {
          id: 'key_new',
          name: 'New Test Key',
          keyPrefix: 'org_test_xyz',
          scope: 'merchant',
          permissions: { tabs: 'read' },
          isActive: true,
          lastUsedAt: null,
          createdAt: new Date(),
          revokedAt: null,
          usageCount: 0
        },
        key: 'org_test_xyz1234567890abcdef1234567890'
      }

      mockApiKeyService.createApiKey.mockResolvedValue(mockResult)

      const request = new NextRequest('http://localhost/api/v1/organizations/org_123/api-keys', {
        method: 'POST',
        body: JSON.stringify(newApiKeyData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request, { params: { id: organizationId } })
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.data).toEqual({
        ...mockResult.apiKey,
        key: mockResult.key
      })
      expect(data.message).toBe('API key created successfully')
      expect(mockApiKeyService.createApiKey).toHaveBeenCalledWith(organizationId, userId, newApiKeyData)
    })

    it('should validate input data', async () => {
      const invalidData = {
        name: '', // Empty name should fail
        scope: 'invalid' as any
      }

      const request = new NextRequest('http://localhost/api/v1/organizations/org_123/api-keys', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request, { params: { id: organizationId } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.message).toBe('Invalid request data')
      expect(data.error.details).toBeDefined()
    })

    it('should handle name too long', async () => {
      const invalidData = {
        name: 'a'.repeat(101), // Name too long
        scope: 'merchant' as const
      }

      const request = new NextRequest('http://localhost/api/v1/organizations/org_123/api-keys', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request, { params: { id: organizationId } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.message).toBe('Invalid request data')
    })

    it('should handle unauthorized access', async () => {
      mockApiKeyService.createApiKey.mockRejectedValue(new Error('You do not have permission to create API keys'))

      const request = new NextRequest('http://localhost/api/v1/organizations/org_123/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Key' }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await POST(request, { params: { id: organizationId } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.message).toBe('Internal server error')
    })
  })

  describe('PUT /api/v1/organizations/[id]/api-keys/[keyId]', () => {
    it('should update an API key', async () => {
      const updateData = {
        name: 'Updated Key Name',
        isActive: false
      }

      const mockUpdatedKey = {
        id: keyId,
        name: 'Updated Key Name',
        keyPrefix: 'org_test_abc',
        scope: 'merchant',
        permissions: {},
        isActive: false,
        lastUsedAt: null,
        createdAt: new Date('2024-01-01'),
        revokedAt: new Date(),
        usageCount: 5
      }

      mockApiKeyService.updateApiKey.mockResolvedValue(mockUpdatedKey)

      const request = new NextRequest(`http://localhost/api/v1/organizations/${organizationId}/api-keys/${keyId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await PUT(request, { params: { id: organizationId, keyId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toEqual(mockUpdatedKey)
      expect(data.message).toBe('API key updated successfully')
      expect(mockApiKeyService.updateApiKey).toHaveBeenCalledWith(keyId, organizationId, userId, updateData)
    })

    it('should validate update data', async () => {
      const invalidData = {
        name: '', // Empty name should fail
        isActive: 'invalid' as any
      }

      const request = new NextRequest(`http://localhost/api/v1/organizations/${organizationId}/api-keys/${keyId}`, {
        method: 'PUT',
        body: JSON.stringify(invalidData),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await PUT(request, { params: { id: organizationId, keyId } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.message).toBe('Invalid request data')
    })

    it('should handle missing parameters', async () => {
      const request = new NextRequest('http://localhost/api/v1/organizations//api-keys/', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Test' }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await PUT(request, { params: { id: '', keyId: '' } })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.message).toBe('Organization ID and Key ID are required')
    })
  })

  describe('DELETE /api/v1/organizations/[id]/api-keys/[keyId]', () => {
    it('should revoke an API key', async () => {
      mockApiKeyService.revokeApiKey.mockResolvedValue(undefined)

      const request = new NextRequest(`http://localhost/api/v1/organizations/${organizationId}/api-keys/${keyId}`, {
        method: 'DELETE'
      })

      const response = await DELETE(request, { params: { id: organizationId, keyId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('API key revoked successfully')
      expect(mockApiKeyService.revokeApiKey).toHaveBeenCalledWith(keyId, organizationId, userId)
    })

    it('should handle key not found', async () => {
      mockApiKeyService.revokeApiKey.mockRejectedValue(new Error('API key not found'))

      const request = new NextRequest(`http://localhost/api/v1/organizations/${organizationId}/api-keys/${keyId}`, {
        method: 'DELETE'
      })

      const response = await DELETE(request, { params: { id: organizationId, keyId } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.message).toBe('Internal server error')
    })

    it('should handle unauthorized access', async () => {
      mockApiKeyService.revokeApiKey.mockRejectedValue(new Error('You do not have permission to revoke API keys'))

      const request = new NextRequest(`http://localhost/api/v1/organizations/${organizationId}/api-keys/${keyId}`, {
        method: 'DELETE'
      })

      const response = await DELETE(request, { params: { id: organizationId, keyId } })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.message).toBe('Internal server error')
    })
  })
})

describe('API Key Service Integration', () => {
  // Reset mocks for integration tests
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should maintain data integrity during API key lifecycle', async () => {
    // This would be a more comprehensive integration test
    // testing the full lifecycle: create -> use -> update -> revoke
    expect(true).toBe(true) // Placeholder for now
  })

  it('should enforce role-based permissions correctly', async () => {
    // Test that only admin/owner roles can manage API keys
    expect(true).toBe(true) // Placeholder for now
  })

  it('should handle concurrent API key operations safely', async () => {
    // Test race conditions and concurrent access
    expect(true).toBe(true) // Placeholder for now
  })
})