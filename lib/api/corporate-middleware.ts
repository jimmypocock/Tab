import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { corporateApiKeys, corporateAccounts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createHash } from 'crypto'
import { headers } from 'next/headers'

export class CorporateApiError extends Error {
  constructor(message: string, public statusCode: number = 401) {
    super(message)
    this.name = 'CorporateApiError'
  }
}

export interface CorporateAuthContext {
  corporateAccount: {
    id: string
    accountNumber: string
    companyName: string
    primaryContactEmail: string
    metadata: any
  }
  apiKey: {
    id: string
    description: string | null
  }
}

// Hash API key for secure comparison
function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export async function withCorporateAuth(
  handler: (req: NextRequest, context: CorporateAuthContext) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    try {
      const headersList = headers()
      const apiKey = headersList.get('x-corporate-api-key')
      
      if (!apiKey) {
        return NextResponse.json(
          { error: 'Corporate API key required' },
          { status: 401 }
        )
      }

      // Validate API key format
      if (!apiKey.startsWith('corp_')) {
        return NextResponse.json(
          { error: 'Invalid corporate API key format' },
          { status: 401 }
        )
      }

      // Hash the API key for lookup
      const keyHash = hashApiKey(apiKey)

      // Look up the API key with corporate account
      const result = await db
        .select({
          apiKey: corporateApiKeys,
          corporateAccount: corporateAccounts,
        })
        .from(corporateApiKeys)
        .innerJoin(
          corporateAccounts,
          eq(corporateApiKeys.corporateAccountId, corporateAccounts.id)
        )
        .where(eq(corporateApiKeys.keyHash, keyHash))
        .limit(1)

      const keyData = result[0]

      if (!keyData || !keyData.apiKey.isActive) {
        return NextResponse.json(
          { error: 'Invalid or inactive corporate API key' },
          { status: 401 }
        )
      }

      // Update last used timestamp
      await db
        .update(corporateApiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(corporateApiKeys.id, keyData.apiKey.id))

      // Create context with corporate account info
      const context: CorporateAuthContext = {
        corporateAccount: {
          id: keyData.corporateAccount.id,
          accountNumber: keyData.corporateAccount.accountNumber,
          companyName: keyData.corporateAccount.companyName,
          primaryContactEmail: keyData.corporateAccount.primaryContactEmail,
          metadata: keyData.corporateAccount.metadata,
        },
        apiKey: {
          id: keyData.apiKey.id,
          description: keyData.apiKey.description,
        },
      }

      // Call the handler with the authenticated context
      return handler(req, context)
    } catch (error) {
      console.error('Corporate authentication error:', error)
      
      if (error instanceof CorporateApiError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.statusCode }
        )
      }

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

// Helper to extract corporate account from request in middleware chain
export async function getCorporateAccount(req: NextRequest): Promise<CorporateAuthContext | null> {
  const headersList = headers()
  const apiKey = headersList.get('x-corporate-api-key')
  
  if (!apiKey || !apiKey.startsWith('corp_')) {
    return null
  }

  try {
    const keyHash = hashApiKey(apiKey)
    
    const result = await db
      .select({
        apiKey: corporateApiKeys,
        corporateAccount: corporateAccounts,
      })
      .from(corporateApiKeys)
      .innerJoin(
        corporateAccounts,
        eq(corporateApiKeys.corporateAccountId, corporateAccounts.id)
      )
      .where(eq(corporateApiKeys.keyHash, keyHash))
      .limit(1)

    const keyData = result[0]

    if (!keyData || !keyData.apiKey.isActive) {
      return null
    }

    return {
      corporateAccount: {
        id: keyData.corporateAccount.id,
        accountNumber: keyData.corporateAccount.accountNumber,
        companyName: keyData.corporateAccount.companyName,
        primaryContactEmail: keyData.corporateAccount.primaryContactEmail,
        metadata: keyData.corporateAccount.metadata,
      },
      apiKey: {
        id: keyData.apiKey.id,
        description: keyData.apiKey.description,
      },
    }
  } catch (error) {
    console.error('Error getting corporate account:', error)
    return null
  }
}