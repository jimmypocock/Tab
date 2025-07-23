import { db } from '@/lib/db'
import {
  corporateAccounts,
  corporateApiKeys,
  corporateMerchantRelationships,
  corporateAccountUsers,
  corporateAccountActivity,
  tabs,
  merchants,
  type NewCorporateAccount,
  type NewCorporateApiKey,
  type NewCorporateMerchantRelationship,
  type NewCorporateAccountUser,
} from '@/lib/db/schema'
import { eq, and, desc, gte, lte, or, inArray } from 'drizzle-orm'
import { createHash, randomBytes } from 'crypto'

export class CorporateAccountService {
  // Generate a unique corporate account number
  static async generateAccountNumber(): Promise<string> {
    const maxAttempts = 10
    
    for (let i = 0; i < maxAttempts; i++) {
      const number = `CORP-${Math.floor(10000 + Math.random() * 90000)}`
      
      // Check if it already exists
      const existing = await db
        .select()
        .from(corporateAccounts)
        .where(eq(corporateAccounts.accountNumber, number))
        .limit(1)
      
      if (existing.length === 0) {
        return number
      }
    }
    
    throw new Error('Failed to generate unique account number')
  }

  // Create a new corporate account
  static async createAccount(data: Omit<NewCorporateAccount, 'id' | 'accountNumber' | 'createdAt' | 'updatedAt'>) {
    const accountNumber = await this.generateAccountNumber()
    
    const [account] = await db
      .insert(corporateAccounts)
      .values({
        ...data,
        accountNumber,
      })
      .returning()
    
    return account
  }

  // Generate corporate API key
  static async generateApiKey(
    corporateAccountId: string,
    description?: string,
    isTestMode: boolean = false
  ) {
    // Generate a secure random API key
    const keyPrefix = isTestMode ? 'corp_test_' : 'corp_live_'
    const randomPart = randomBytes(32).toString('hex')
    const apiKey = `${keyPrefix}${randomPart}`
    
    // Hash the key for storage
    const keyHash = createHash('sha256').update(apiKey).digest('hex')
    
    // Store the hashed key
    const [storedKey] = await db
      .insert(corporateApiKeys)
      .values({
        corporateAccountId,
        keyHash,
        keyPrefix: apiKey.substring(0, 13), // Store prefix for identification
        description,
      })
      .returning()
    
    // Return the full key (only shown once)
    return {
      key: apiKey,
      keyData: storedKey,
    }
  }

  // Create merchant relationship
  static async createMerchantRelationship(
    data: Omit<NewCorporateMerchantRelationship, 'id' | 'createdAt' | 'updatedAt'>
  ) {
    // Check if relationship already exists
    const existing = await db
      .select()
      .from(corporateMerchantRelationships)
      .where(
        and(
          eq(corporateMerchantRelationships.corporateAccountId, data.corporateAccountId),
          eq(corporateMerchantRelationships.merchantId, data.merchantId)
        )
      )
      .limit(1)
    
    if (existing.length > 0) {
      throw new Error('Relationship already exists with this merchant')
    }
    
    const [relationship] = await db
      .insert(corporateMerchantRelationships)
      .values(data)
      .returning()
    
    return relationship
  }

  // Get all tabs for a corporate account
  static async getCorporateTabs(
    corporateAccountId: string,
    filters?: {
      merchantId?: string
      status?: string
      dateFrom?: Date
      dateTo?: Date
    }
  ) {
    let query = db
      .select({
        tab: tabs,
        merchant: merchants,
        relationship: corporateMerchantRelationships,
      })
      .from(tabs)
      .innerJoin(merchants, eq(tabs.merchantId, merchants.id))
      .leftJoin(
        corporateMerchantRelationships,
        eq(tabs.corporateRelationshipId, corporateMerchantRelationships.id)
      )
      .where(eq(tabs.corporateAccountId, corporateAccountId))
      .$dynamic()
    
    // Apply filters
    if (filters?.merchantId) {
      query = query.where(eq(tabs.merchantId, filters.merchantId))
    }
    
    if (filters?.status) {
      query = query.where(eq(tabs.status, filters.status))
    }
    
    if (filters?.dateFrom) {
      query = query.where(gte(tabs.createdAt, filters.dateFrom))
    }
    
    if (filters?.dateTo) {
      query = query.where(lte(tabs.createdAt, filters.dateTo))
    }
    
    const results = await query.orderBy(desc(tabs.createdAt))
    
    return results
  }

  // Get merchant relationships for a corporate account
  static async getMerchantRelationships(corporateAccountId: string) {
    const relationships = await db
      .select({
        relationship: corporateMerchantRelationships,
        merchant: merchants,
      })
      .from(corporateMerchantRelationships)
      .innerJoin(
        merchants,
        eq(corporateMerchantRelationships.merchantId, merchants.id)
      )
      .where(eq(corporateMerchantRelationships.corporateAccountId, corporateAccountId))
      .orderBy(corporateMerchantRelationships.createdAt)
    
    return relationships
  }

  // Add authorized user to corporate account
  static async addUser(data: Omit<NewCorporateAccountUser, 'id' | 'createdAt' | 'updatedAt'>) {
    const [user] = await db
      .insert(corporateAccountUsers)
      .values(data)
      .returning()
    
    return user
  }

  // Log activity
  static async logActivity(data: {
    corporateAccountId: string
    merchantId?: string
    userId?: string
    action: string
    entityType?: string
    entityId?: string
    metadata?: any
    ipAddress?: string
    userAgent?: string
  }) {
    await db.insert(corporateAccountActivity).values(data)
  }

  // Check if corporate account has access to a merchant
  static async hasAccessToMerchant(
    corporateAccountId: string,
    merchantId: string
  ): Promise<boolean> {
    const relationship = await db
      .select()
      .from(corporateMerchantRelationships)
      .where(
        and(
          eq(corporateMerchantRelationships.corporateAccountId, corporateAccountId),
          eq(corporateMerchantRelationships.merchantId, merchantId),
          eq(corporateMerchantRelationships.status, 'active')
        )
      )
      .limit(1)
    
    return relationship.length > 0
  }

  // Get spending analytics
  static async getSpendingAnalytics(
    corporateAccountId: string,
    dateFrom: Date,
    dateTo: Date
  ) {
    const tabData = await db
      .select({
        merchantId: tabs.merchantId,
        merchantName: merchants.businessName,
        totalAmount: tabs.totalAmount,
        paidAmount: tabs.paidAmount,
        status: tabs.status,
        createdAt: tabs.createdAt,
      })
      .from(tabs)
      .innerJoin(merchants, eq(tabs.merchantId, merchants.id))
      .where(
        and(
          eq(tabs.corporateAccountId, corporateAccountId),
          gte(tabs.createdAt, dateFrom),
          lte(tabs.createdAt, dateTo)
        )
      )
    
    // Aggregate by merchant
    const byMerchant = tabData.reduce((acc, tab) => {
      if (!acc[tab.merchantId]) {
        acc[tab.merchantId] = {
          merchantId: tab.merchantId,
          merchantName: tab.merchantName,
          totalSpent: 0,
          totalPaid: 0,
          tabCount: 0,
        }
      }
      
      acc[tab.merchantId].totalSpent += parseFloat(tab.totalAmount)
      acc[tab.merchantId].totalPaid += parseFloat(tab.paidAmount)
      acc[tab.merchantId].tabCount += 1
      
      return acc
    }, {} as Record<string, any>)
    
    return {
      byMerchant: Object.values(byMerchant),
      total: {
        totalSpent: tabData.reduce((sum, tab) => sum + parseFloat(tab.totalAmount), 0),
        totalPaid: tabData.reduce((sum, tab) => sum + parseFloat(tab.paidAmount), 0),
        tabCount: tabData.length,
      },
    }
  }
}