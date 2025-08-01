/**
 * Invitation Details Endpoint Tests
 */

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/v1/auth/invitation-details/route'

// Mock dependencies
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: {
              id: 'inv_123',
              email: 'test@example.com',
              role: 'member',
              expires_at: new Date(Date.now() + 86400000).toISOString(), // 1 day from now
              status: 'pending',
              organizations: {
                id: 'org_123',
                name: 'Test Organization'
              }
            }
          }))
        }))
      }))
    }))
  }))
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}))

describe('GET /api/v1/auth/invitation-details', () => {
  it('should return invitation details for valid token', async () => {
    const request = new NextRequest('http://localhost:3000/api/v1/auth/invitation-details?token=test_token')
    
    const response = await GET(request)
    const data = await response.json()
    
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data).toEqual({
      email: 'test@example.com',
      role: 'member',
      organizationName: 'Test Organization',
      organizationId: 'org_123',
      expiresAt: expect.any(String)
    })
  })

  it('should return 400 for missing token', async () => {
    const request = new NextRequest('http://localhost:3000/api/v1/auth/invitation-details')
    
    const response = await GET(request)
    const data = await response.json()
    
    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
    expect(data.error).toBeTruthy()
  })
})