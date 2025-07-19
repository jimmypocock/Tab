import { db } from '@/lib/db/client'
import { merchantProcessors, MerchantProcessor, NewMerchantProcessor } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { EncryptionService } from '@/lib/payment-processors/encryption'
import { ProcessorFactory } from '@/lib/payment-processors/factory'
import { IPaymentProcessor } from '@/lib/payment-processors/interface'
import { 
  ProcessorType, 
  ProcessorConfig,
  processorCredentialSchemas,
  ProcessorConfigurationError,
} from '@/lib/payment-processors/types'
import { NotFoundError, ValidationError, ConflictError, DatabaseError } from '@/lib/errors'
import { logger } from '@/lib/logger'

export class MerchantProcessorService {
  /**
   * Get all processors for a merchant
   */
  static async getMerchantProcessors(merchantId: string): Promise<MerchantProcessor[]> {
    try {
      const processors = await db.query.merchantProcessors.findMany({
        where: eq(merchantProcessors.merchantId, merchantId),
        orderBy: (processors, { desc }) => [desc(processors.createdAt)],
      })

      // Don't return decrypted credentials
      return processors.map(p => ({
        ...p,
        encryptedCredentials: { masked: true },
        webhookSecret: p.webhookSecret ? 'CONFIGURED' : null,
      }))
    } catch (error) {
      logger.error('Failed to get merchant processors', error as Error, { merchantId })
      throw error
    }
  }

  /**
   * Get a specific processor
   */
  static async getProcessor(
    merchantId: string, 
    processorType: ProcessorType,
    isTestMode: boolean = true
  ): Promise<MerchantProcessor | null> {
    try {
      const processor = await db.query.merchantProcessors.findFirst({
        where: and(
          eq(merchantProcessors.merchantId, merchantId),
          eq(merchantProcessors.processorType, processorType),
          eq(merchantProcessors.isTestMode, isTestMode),
          eq(merchantProcessors.isActive, true)
        ),
      })

      if (!processor) return null

      // Don't return decrypted credentials
      return {
        ...processor,
        encryptedCredentials: { masked: true },
        webhookSecret: processor.webhookSecret ? 'CONFIGURED' : null,
      }
    } catch (error) {
      logger.error('Failed to get processor', error as Error, { merchantId, processorType })
      throw error
    }
  }

  /**
   * Create a payment processor instance
   */
  static async createProcessorInstance(
    merchantId: string,
    processorType: ProcessorType,
    isTestMode: boolean = true
  ): Promise<IPaymentProcessor> {
    const processor = await db.query.merchantProcessors.findFirst({
      where: and(
        eq(merchantProcessors.merchantId, merchantId),
        eq(merchantProcessors.processorType, processorType),
        eq(merchantProcessors.isTestMode, isTestMode),
        eq(merchantProcessors.isActive, true)
      ),
    })

    if (!processor) {
      throw new NotFoundError(`Payment processor configuration not found: ${processorType}`)
    }

    // Decrypt credentials
    const decryptedCredentials = EncryptionService.decrypt(
      processor.encryptedCredentials as string
    )

    const config: ProcessorConfig = {
      processorType: processor.processorType as ProcessorType,
      isTestMode: processor.isTestMode,
      credentials: decryptedCredentials,
      webhookSecret: processor.webhookSecret || undefined,
    }

    return ProcessorFactory.create(config)
  }

  /**
   * Add a new processor configuration
   */
  static async addProcessor(
    merchantId: string,
    processorType: ProcessorType,
    credentials: any,
    isTestMode: boolean = true
  ): Promise<MerchantProcessor> {
    try {
      // Validate processor is supported
      if (!ProcessorFactory.isSupported(processorType)) {
        throw new ValidationError(`Processor type not supported: ${processorType}`)
      }

      // Validate credentials schema
      const schema = processorCredentialSchemas[processorType]
      const validatedCredentials = schema.parse(credentials)

      // Check if processor already exists
      const existing = await this.getProcessor(merchantId, processorType, isTestMode)
      if (existing) {
        throw new ConflictError('Processor configuration already exists')
      }

      // Test the credentials
      const testConfig: ProcessorConfig = {
        processorType,
        isTestMode,
        credentials: validatedCredentials,
      }
      
      const processor = ProcessorFactory.create(testConfig)
      const isValid = await processor.validateCredentials()
      
      if (!isValid) {
        throw new ProcessorConfigurationError('Invalid processor credentials', processorType)
      }

      // Encrypt credentials
      const encryptedCredentials = EncryptionService.encrypt(validatedCredentials)
      const webhookSecret = EncryptionService.generateWebhookSecret()

      // Save to database
      const [newProcessor] = await db.insert(merchantProcessors).values({
        merchantId,
        processorType,
        isTestMode,
        isActive: true,
        encryptedCredentials,
        webhookSecret,
      }).returning()

      if (!newProcessor) {
        throw new DatabaseError('Failed to create processor configuration')
      }

      logger.info('Processor configuration added', {
        merchantId,
        processorType,
        processorId: newProcessor.id,
      })

      // Return without credentials
      return {
        ...newProcessor,
        encryptedCredentials: { masked: true },
        webhookSecret: 'CONFIGURED',
      }
    } catch (error) {
      logger.error('Failed to add processor', error as Error, { merchantId, processorType })
      throw error
    }
  }

  /**
   * Update processor configuration
   */
  static async updateProcessor(
    merchantId: string,
    processorId: string,
    updates: {
      credentials?: any
      isActive?: boolean
    }
  ): Promise<MerchantProcessor> {
    try {
      // Get existing processor
      const existing = await db.query.merchantProcessors.findFirst({
        where: and(
          eq(merchantProcessors.id, processorId),
          eq(merchantProcessors.merchantId, merchantId)
        ),
      })

      if (!existing) {
        throw new NotFoundError('Processor configuration not found')
      }

      const updateData: Partial<NewMerchantProcessor> = {
        updatedAt: new Date(),
      }

      // Handle credentials update
      if (updates.credentials) {
        const schema = processorCredentialSchemas[existing.processorType as ProcessorType]
        const validatedCredentials = schema.parse(updates.credentials)

        // Test new credentials
        const testConfig: ProcessorConfig = {
          processorType: existing.processorType as ProcessorType,
          isTestMode: existing.isTestMode,
          credentials: validatedCredentials,
        }
        
        const processor = ProcessorFactory.create(testConfig)
        const isValid = await processor.validateCredentials()
        
        if (!isValid) {
          throw new ProcessorConfigurationError(
            'Invalid processor credentials', 
            existing.processorType as ProcessorType
          )
        }

        updateData.encryptedCredentials = EncryptionService.encrypt(validatedCredentials)
      }

      // Handle active status update
      if (updates.isActive !== undefined) {
        updateData.isActive = updates.isActive
      }

      // Update in database
      const [updated] = await db
        .update(merchantProcessors)
        .set(updateData)
        .where(eq(merchantProcessors.id, processorId))
        .returning()

      if (!updated) {
        throw new DatabaseError('Failed to update processor configuration')
      }

      logger.info('Processor configuration updated', {
        merchantId,
        processorId,
        updates: Object.keys(updates),
      })

      // Return without credentials
      return {
        ...updated,
        encryptedCredentials: { masked: true },
        webhookSecret: updated.webhookSecret ? 'CONFIGURED' : null,
      }
    } catch (error) {
      logger.error('Failed to update processor', error as Error, { merchantId, processorId })
      throw error
    }
  }

  /**
   * Delete processor configuration
   */
  static async deleteProcessor(
    merchantId: string,
    processorId: string
  ): Promise<void> {
    try {
      const result = await db
        .delete(merchantProcessors)
        .where(and(
          eq(merchantProcessors.id, processorId),
          eq(merchantProcessors.merchantId, merchantId)
        ))
        .returning()

      if (result.length === 0) {
        throw new NotFoundError('Processor configuration not found')
      }

      logger.info('Processor configuration deleted', { merchantId, processorId })
    } catch (error) {
      logger.error('Failed to delete processor', error as Error, { merchantId, processorId })
      throw error
    }
  }

  /**
   * Get webhook endpoint URL for a processor
   */
  static getWebhookUrl(processorType: ProcessorType): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    return `${baseUrl}/api/v1/webhooks/${processorType}`
  }
}