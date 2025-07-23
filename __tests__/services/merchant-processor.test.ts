/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals'

// Mock dependencies
const mockDb = {
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  transaction: jest.fn(),
  query: {
    merchantProcessors: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    merchants: {
      findFirst: jest.fn(),
    },
  },
}

// Mock encryption
const mockEncryption = {
  encryptCredentials: jest.fn((data) => ({
    encryptedData: Buffer.from(JSON.stringify(data)).toString('base64'),
    iv: 'mock_iv',
    authTag: 'mock_auth_tag',
  })),
  decryptCredentials: jest.fn((encryptedData) => {
    return JSON.parse(Buffer.from(encryptedData, 'base64').toString())
  }),
}

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}

// Service class under test
class MerchantProcessorService {
  constructor(
    private db: any,
    private encryption: any,
    private logger: any
  ) {}

  async connectProcessor(
    merchantId: string,
    processorType: string,
    credentials: Record<string, any>,
    options?: {
      isDefault?: boolean
      metadata?: Record<string, any>
    }
  ) {
    try {
      // Validate merchant exists
      const merchant = await this.db.query.merchants.findFirst({
        where: { id: merchantId }
      })
      
      if (!merchant) {
        throw new Error('Merchant not found')
      }

      // Check for existing processor of same type
      const existing = await this.db.query.merchantProcessors.findFirst({
        where: { 
          merchantId,
          processorType,
          status: 'active'
        }
      })

      if (existing) {
        throw new Error(`${processorType} processor already connected`)
      }

      // Encrypt credentials
      const { encryptedData, iv, authTag } = this.encryption.encryptCredentials(credentials)

      // If this should be default, unset other defaults
      if (options?.isDefault) {
        await this.db.update('merchant_processors')
          .set({ isDefault: false })
          .where({ merchantId, isDefault: true })
      }

      // Create processor record
      const processor = await this.db.insert('merchant_processors').values({
        merchantId,
        processorType,
        credentials: encryptedData,
        encryptionIv: iv,
        encryptionAuthTag: authTag,
        isDefault: options?.isDefault || false,
        metadata: options?.metadata || {},
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning()

      this.logger.info(`Connected ${processorType} processor for merchant ${merchantId}`)
      
      return processor[0]
    } catch (error) {
      this.logger.error(`Failed to connect processor: ${error.message}`)
      throw error
    }
  }

  async disconnectProcessor(merchantId: string, processorId: string) {
    try {
      const processor = await this.db.query.merchantProcessors.findFirst({
        where: { id: processorId, merchantId }
      })

      if (!processor) {
        throw new Error('Processor not found')
      }

      if (processor.isDefault) {
        // Find another processor to make default
        const otherProcessor = await this.db.query.merchantProcessors.findFirst({
          where: { 
            merchantId,
            id: { not: processorId },
            status: 'active'
          }
        })

        if (otherProcessor) {
          await this.db.update('merchant_processors')
            .set({ isDefault: true })
            .where({ id: otherProcessor.id })
        }
      }

      // Soft delete the processor
      await this.db.update('merchant_processors')
        .set({ 
          status: 'disconnected',
          disconnectedAt: new Date(),
          updatedAt: new Date()
        })
        .where({ id: processorId })

      this.logger.info(`Disconnected processor ${processorId} for merchant ${merchantId}`)
      
      return true
    } catch (error) {
      this.logger.error(`Failed to disconnect processor: ${error.message}`)
      throw error
    }
  }

  async getProcessorCredentials(merchantId: string, processorId: string) {
    try {
      const processor = await this.db.query.merchantProcessors.findFirst({
        where: { 
          id: processorId,
          merchantId,
          status: 'active'
        }
      })

      if (!processor) {
        throw new Error('Active processor not found')
      }

      // Decrypt credentials
      const decrypted = this.encryption.decryptCredentials(
        processor.credentials,
        processor.encryptionIv,
        processor.encryptionAuthTag
      )

      return {
        processorType: processor.processorType,
        credentials: decrypted,
        metadata: processor.metadata,
      }
    } catch (error) {
      this.logger.error(`Failed to get processor credentials: ${error.message}`)
      throw error
    }
  }

  async getActiveProcessors(merchantId: string) {
    try {
      const processors = await this.db.query.merchantProcessors.findMany({
        where: { 
          merchantId,
          status: 'active'
        },
        orderBy: { isDefault: 'desc' }
      })

      return processors.map(p => ({
        id: p.id,
        processorType: p.processorType,
        isDefault: p.isDefault,
        metadata: p.metadata,
        connectedAt: p.createdAt,
      }))
    } catch (error) {
      this.logger.error(`Failed to get active processors: ${error.message}`)
      throw error
    }
  }

  async setDefaultProcessor(merchantId: string, processorId: string) {
    try {
      const processor = await this.db.query.merchantProcessors.findFirst({
        where: { 
          id: processorId,
          merchantId,
          status: 'active'
        }
      })

      if (!processor) {
        throw new Error('Active processor not found')
      }

      // Unset current default
      await this.db.update('merchant_processors')
        .set({ isDefault: false })
        .where({ merchantId, isDefault: true })

      // Set new default
      await this.db.update('merchant_processors')
        .set({ isDefault: true })
        .where({ id: processorId })

      this.logger.info(`Set processor ${processorId} as default for merchant ${merchantId}`)
      
      return true
    } catch (error) {
      this.logger.error(`Failed to set default processor: ${error.message}`)
      throw error
    }
  }

  async updateProcessorMetadata(
    merchantId: string,
    processorId: string,
    metadata: Record<string, any>
  ) {
    try {
      const processor = await this.db.query.merchantProcessors.findFirst({
        where: { 
          id: processorId,
          merchantId
        }
      })

      if (!processor) {
        throw new Error('Processor not found')
      }

      await this.db.update('merchant_processors')
        .set({ 
          metadata: { ...processor.metadata, ...metadata },
          updatedAt: new Date()
        })
        .where({ id: processorId })

      return true
    } catch (error) {
      this.logger.error(`Failed to update processor metadata: ${error.message}`)
      throw error
    }
  }
}

describe('MerchantProcessorService', () => {
  let service: MerchantProcessorService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new MerchantProcessorService(mockDb, mockEncryption, mockLogger)
  })

  describe('connectProcessor', () => {
    const mockMerchant = { id: 'merchant_123', businessName: 'Test Business' }
    const mockCredentials = { apiKey: 'sk_test_123', apiSecret: 'secret_456' }

    beforeEach(() => {
      mockDb.query.merchants.findFirst.mockResolvedValue(mockMerchant)
      mockDb.query.merchantProcessors.findFirst.mockResolvedValue(null)
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{
            id: 'processor_123',
            merchantId: 'merchant_123',
            processorType: 'stripe',
            isDefault: true,
          }])
        })
      })
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue({ success: true })
        })
      })
    })

    it('should connect a new processor successfully', async () => {
      const result = await service.connectProcessor(
        'merchant_123',
        'stripe',
        mockCredentials,
        { isDefault: true }
      )

      expect(result).toMatchObject({
        id: 'processor_123',
        processorType: 'stripe',
        isDefault: true,
      })

      expect(mockEncryption.encryptCredentials).toHaveBeenCalledWith(mockCredentials)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Connected stripe processor for merchant merchant_123'
      )
    })

    it('should throw error if merchant not found', async () => {
      mockDb.query.merchants.findFirst.mockResolvedValue(null)

      await expect(
        service.connectProcessor('invalid_merchant', 'stripe', mockCredentials)
      ).rejects.toThrow('Merchant not found')
    })

    it('should throw error if processor already connected', async () => {
      mockDb.query.merchantProcessors.findFirst.mockResolvedValue({
        id: 'existing_processor',
        processorType: 'stripe',
        status: 'active',
      })

      await expect(
        service.connectProcessor('merchant_123', 'stripe', mockCredentials)
      ).rejects.toThrow('stripe processor already connected')
    })

    it('should unset other defaults when connecting as default', async () => {
      await service.connectProcessor(
        'merchant_123',
        'stripe',
        mockCredentials,
        { isDefault: true }
      )

      expect(mockDb.update).toHaveBeenCalledWith('merchant_processors')
      expect(mockDb.update().set).toHaveBeenCalledWith({ isDefault: false })
    })

    it('should handle encryption errors', async () => {
      mockEncryption.encryptCredentials.mockImplementation(() => {
        throw new Error('Encryption failed')
      })

      await expect(
        service.connectProcessor('merchant_123', 'stripe', mockCredentials)
      ).rejects.toThrow('Encryption failed')

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to connect processor: Encryption failed'
      )
    })
  })

  describe('disconnectProcessor', () => {
    const mockProcessor = {
      id: 'processor_123',
      merchantId: 'merchant_123',
      processorType: 'stripe',
      isDefault: true,
      status: 'active',
    }

    beforeEach(() => {
      mockDb.query.merchantProcessors.findFirst.mockResolvedValue(mockProcessor)
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue({ success: true })
        })
      })
    })

    it('should disconnect processor successfully', async () => {
      const result = await service.disconnectProcessor('merchant_123', 'processor_123')

      expect(result).toBe(true)
      expect(mockDb.update).toHaveBeenCalledWith('merchant_processors')
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Disconnected processor processor_123 for merchant merchant_123'
      )
    })

    it('should reassign default to another processor', async () => {
      const otherProcessor = {
        id: 'processor_456',
        processorType: 'square',
        status: 'active',
      }

      mockDb.query.merchantProcessors.findFirst
        .mockResolvedValueOnce(mockProcessor)
        .mockResolvedValueOnce(otherProcessor)

      await service.disconnectProcessor('merchant_123', 'processor_123')

      expect(mockDb.update).toHaveBeenCalledTimes(2)
      // First call to set new default
      expect(mockDb.update().set).toHaveBeenCalledWith({ isDefault: true })
    })

    it('should throw error if processor not found', async () => {
      mockDb.query.merchantProcessors.findFirst.mockResolvedValue(null)

      await expect(
        service.disconnectProcessor('merchant_123', 'invalid_processor')
      ).rejects.toThrow('Processor not found')
    })
  })

  describe('getProcessorCredentials', () => {
    const mockProcessor = {
      id: 'processor_123',
      merchantId: 'merchant_123',
      processorType: 'stripe',
      credentials: 'encrypted_data',
      encryptionIv: 'mock_iv',
      encryptionAuthTag: 'mock_auth_tag',
      metadata: { webhookUrl: 'https://example.com/webhook' },
      status: 'active',
    }

    beforeEach(() => {
      mockDb.query.merchantProcessors.findFirst.mockResolvedValue(mockProcessor)
      mockEncryption.decryptCredentials.mockReturnValue({
        apiKey: 'sk_test_123',
        apiSecret: 'secret_456',
      })
    })

    it('should get and decrypt credentials successfully', async () => {
      const result = await service.getProcessorCredentials('merchant_123', 'processor_123')

      expect(result).toEqual({
        processorType: 'stripe',
        credentials: {
          apiKey: 'sk_test_123',
          apiSecret: 'secret_456',
        },
        metadata: { webhookUrl: 'https://example.com/webhook' },
      })

      expect(mockEncryption.decryptCredentials).toHaveBeenCalledWith(
        'encrypted_data',
        'mock_iv',
        'mock_auth_tag'
      )
    })

    it('should throw error if processor not active', async () => {
      mockDb.query.merchantProcessors.findFirst.mockResolvedValue(null)

      await expect(
        service.getProcessorCredentials('merchant_123', 'processor_123')
      ).rejects.toThrow('Active processor not found')
    })

    it('should handle decryption errors', async () => {
      mockEncryption.decryptCredentials.mockImplementation(() => {
        throw new Error('Decryption failed')
      })

      await expect(
        service.getProcessorCredentials('merchant_123', 'processor_123')
      ).rejects.toThrow('Decryption failed')
    })
  })

  describe('getActiveProcessors', () => {
    const mockProcessors = [
      {
        id: 'processor_123',
        processorType: 'stripe',
        isDefault: true,
        metadata: {},
        createdAt: new Date('2024-01-01'),
      },
      {
        id: 'processor_456',
        processorType: 'square',
        isDefault: false,
        metadata: { location: 'US' },
        createdAt: new Date('2024-01-15'),
      },
    ]

    beforeEach(() => {
      mockDb.query.merchantProcessors.findMany.mockResolvedValue(mockProcessors)
    })

    it('should return active processors sorted by default', async () => {
      const result = await service.getActiveProcessors('merchant_123')

      expect(result).toHaveLength(2)
      expect(result[0].isDefault).toBe(true)
      expect(result[0].processorType).toBe('stripe')
      expect(result[1].processorType).toBe('square')
    })

    it('should handle empty processor list', async () => {
      mockDb.query.merchantProcessors.findMany.mockResolvedValue([])

      const result = await service.getActiveProcessors('merchant_123')

      expect(result).toEqual([])
    })
  })

  describe('setDefaultProcessor', () => {
    const mockProcessor = {
      id: 'processor_123',
      merchantId: 'merchant_123',
      processorType: 'stripe',
      status: 'active',
    }

    beforeEach(() => {
      mockDb.query.merchantProcessors.findFirst.mockResolvedValue(mockProcessor)
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue({ success: true })
        })
      })
    })

    it('should set processor as default', async () => {
      const result = await service.setDefaultProcessor('merchant_123', 'processor_123')

      expect(result).toBe(true)
      expect(mockDb.update).toHaveBeenCalledTimes(2)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Set processor processor_123 as default for merchant merchant_123'
      )
    })

    it('should throw error if processor not active', async () => {
      mockDb.query.merchantProcessors.findFirst.mockResolvedValue(null)

      await expect(
        service.setDefaultProcessor('merchant_123', 'invalid_processor')
      ).rejects.toThrow('Active processor not found')
    })
  })

  describe('updateProcessorMetadata', () => {
    const mockProcessor = {
      id: 'processor_123',
      merchantId: 'merchant_123',
      metadata: { existing: 'data' },
    }

    beforeEach(() => {
      mockDb.query.merchantProcessors.findFirst.mockResolvedValue(mockProcessor)
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue({ success: true })
        })
      })
    })

    it('should update metadata successfully', async () => {
      const newMetadata = { webhookUrl: 'https://new-webhook.com' }
      
      const result = await service.updateProcessorMetadata(
        'merchant_123',
        'processor_123',
        newMetadata
      )

      expect(result).toBe(true)
      expect(mockDb.update().set).toHaveBeenCalledWith({
        metadata: { existing: 'data', webhookUrl: 'https://new-webhook.com' },
        updatedAt: expect.any(Date),
      })
    })

    it('should throw error if processor not found', async () => {
      mockDb.query.merchantProcessors.findFirst.mockResolvedValue(null)

      await expect(
        service.updateProcessorMetadata('merchant_123', 'invalid_processor', {})
      ).rejects.toThrow('Processor not found')
    })
  })
})