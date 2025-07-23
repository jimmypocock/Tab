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
import { WebhookConfigService } from './webhook-config.service'

// Note: This service still uses 'merchant' in its name for backward compatibility
// but internally works with organizations
export class MerchantProcessorService {
  /**
   * Get all processors for an organization
   */
  static async getMerchantProcessors(organizationId: string): Promise<MerchantProcessor[]> {
    try {
      const processors = await db.query.merchantProcessors.findMany({
        where: eq(merchantProcessors.organizationId, organizationId),
        orderBy: (processors, { desc }) => [desc(processors.createdAt)],
      })

      // Don't return decrypted credentials
      return processors.map(p => ({
        ...p,
        encryptedCredentials: { masked: true },
        webhookSecret: p.webhookSecret ? 'CONFIGURED' : null,
      }))
    } catch (error) {
      logger.error('Failed to get organization processors', error as Error, { organizationId })
      throw error
    }
  }

  /**
   * Get a specific processor
   */
  static async getProcessor(
    organizationId: string, 
    processorType: ProcessorType,
    isTestMode: boolean = true
  ): Promise<MerchantProcessor | null> {
    try {
      const processor = await db.query.merchantProcessors.findFirst({
        where: and(
          eq(merchantProcessors.organizationId, organizationId),
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
      logger.error('Failed to get processor', error as Error, { organizationId, processorType })
      throw error
    }
  }

  /**
   * Create a payment processor instance
   */
  static async createProcessorInstance(
    organizationId: string,
    processorType: ProcessorType,
    isTestMode: boolean = true
  ): Promise<IPaymentProcessor> {
    const processor = await db.query.merchantProcessors.findFirst({
      where: and(
        eq(merchantProcessors.organizationId, organizationId),
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
    organizationId: string,
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
      
      // Auto-detect test mode from credentials
      let detectedTestMode = true // default to test mode
      if (processorType === ProcessorType.STRIPE) {
        // Check if secret key starts with sk_test_ or sk_live_
        detectedTestMode = validatedCredentials.secretKey.startsWith('sk_test_')
      } else if (processorType === ProcessorType.SQUARE) {
        // Square uses environment field
        detectedTestMode = validatedCredentials.environment !== 'production'
      } else if (processorType === ProcessorType.PAYPAL) {
        // PayPal test mode detection could be based on client ID pattern
        // For now, default to test mode
      } else if (processorType === ProcessorType.AUTHORIZE_NET) {
        // Authorize.Net test mode detection could be based on endpoint
        // For now, default to test mode
      }

      // Use detected test mode
      isTestMode = detectedTestMode

      // Check if processor already exists
      const existing = await this.getProcessor(organizationId, processorType, isTestMode)
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
      
      // Automatically configure webhook
      const webhookConfig = await WebhookConfigService.configureWebhook(
        processorType,
        validatedCredentials,
        organizationId
      )

      // Save to database with webhook configuration
      // For Stripe, we don't store webhook secret as it comes from environment variable
      const [newProcessor] = await db.insert(merchantProcessors).values({
        organizationId,
        processorType,
        isTestMode,
        isActive: true,
        encryptedCredentials,
        webhookSecret: processorType === 'stripe' ? null : webhookConfig.webhookSecret,
        metadata: webhookConfig.webhookId ? { webhookId: webhookConfig.webhookId } : undefined,
      }).returning()

      if (!newProcessor) {
        throw new DatabaseError('Failed to create processor configuration')
      }

      logger.info('Processor configuration added', {
        organizationId,
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
      logger.error('Failed to add processor', error as Error, { organizationId, processorType })
      throw error
    }
  }

  /**
   * Update processor configuration
   */
  static async updateProcessor(
    organizationId: string,
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
          eq(merchantProcessors.organizationId, organizationId)
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
          throw new ProcessorConfigurationError('Invalid processor credentials', existing.processorType as ProcessorType)
        }

        updateData.encryptedCredentials = EncryptionService.encrypt(validatedCredentials)
      }

      // Handle isActive update
      if (updates.isActive !== undefined) {
        updateData.isActive = updates.isActive
      }

      // Update in database
      const [updated] = await db
        .update(merchantProcessors)
        .set(updateData)
        .where(and(
          eq(merchantProcessors.id, processorId),
          eq(merchantProcessors.organizationId, organizationId)
        ))
        .returning()

      if (!updated) {
        throw new DatabaseError('Failed to update processor configuration')
      }

      logger.info('Processor configuration updated', {
        organizationId,
        processorId,
        processorType: updated.processorType,
      })

      // Return without credentials
      return {
        ...updated,
        encryptedCredentials: { masked: true },
        webhookSecret: updated.webhookSecret ? 'CONFIGURED' : null,
      }
    } catch (error) {
      logger.error('Failed to update processor', error as Error, { organizationId, processorId })
      throw error
    }
  }

  /**
   * Delete processor configuration
   */
  static async deleteProcessor(
    organizationId: string,
    processorId: string
  ): Promise<void> {
    try {
      const result = await db
        .delete(merchantProcessors)
        .where(and(
          eq(merchantProcessors.id, processorId),
          eq(merchantProcessors.organizationId, organizationId)
        ))

      logger.info('Processor configuration deleted', {
        organizationId,
        processorId,
      })
    } catch (error) {
      logger.error('Failed to delete processor', error as Error, { organizationId, processorId })
      throw error
    }
  }

  /**
   * Get the default/primary processor for an organization
   */
  static async getDefaultProcessor(
    organizationId: string,
    isTestMode: boolean = true
  ): Promise<MerchantProcessor | null> {
    // For now, prioritize Stripe, then any active processor
    const processors = await db.query.merchantProcessors.findMany({
      where: and(
        eq(merchantProcessors.organizationId, organizationId),
        eq(merchantProcessors.isTestMode, isTestMode),
        eq(merchantProcessors.isActive, true)
      ),
      orderBy: (processors, { asc, desc }) => [
        // Prioritize Stripe
        desc(processors.processorType),
        // Then by creation date
        asc(processors.createdAt)
      ],
    })

    if (processors.length === 0) return null

    // Return without credentials
    const processor = processors[0]
    return {
      ...processor,
      encryptedCredentials: { masked: true },
      webhookSecret: processor.webhookSecret ? 'CONFIGURED' : null,
    }
  }

  /**
   * Get the webhook URL for a specific processor type
   */
  static getWebhookUrl(processorType: ProcessorType): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    return `${baseUrl}/api/v1/webhooks/${processorType.toLowerCase()}`
  }
}