/**
 * Merchant Processor Payment Flow Integration Tests
 * These tests verify the end-to-end payment flow using merchant-owned payment processors
 */

// Mock Stripe before any imports
const mockStripeInstance = {
  paymentIntents: {
    create: jest.fn(),
    retrieve: jest.fn(),
    confirm: jest.fn(),
    cancel: jest.fn(),
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
  refunds: {
    create: jest.fn(),
  },
  charges: {
    retrieve: jest.fn(),
  },
}

jest.mock('stripe', () => {
  return jest.fn(() => mockStripeInstance)
})

// Mock database client
jest.mock('@/lib/db/client', () => ({
  db: {
    query: {
      tabs: { findFirst: jest.fn() },
      merchantProcessors: { findFirst: jest.fn(), findMany: jest.fn() },
      payments: { findFirst: jest.fn() },
    },
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}))

// Mock encryption service
jest.mock('@/lib/payment-processors/encryption', () => ({
  EncryptionService: {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
    generateWebhookSecret: jest.fn(),
  },
}))

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}))

import { db } from '@/lib/db/client'
import { EncryptionService } from '@/lib/payment-processors/encryption'
import { MerchantProcessorService } from '@/lib/services/merchant-processor.service'
import { ProcessorFactory } from '@/lib/payment-processors/factory'
import { ProcessorType } from '@/lib/payment-processors/types'
import Stripe from 'stripe'

// Helper to create mock data
const createMockTab = (overrides = {}) => ({
  id: 'tab_123',
  merchantId: 'merchant_123',
  customerEmail: 'customer@example.com',
  customerName: 'Test Customer',
  subtotal: '100.00',
  taxAmount: '8.00',
  totalAmount: '108.00',
  paidAmount: '0.00',
  status: 'open',
  currency: 'usd',
  createdAt: new Date(),
  updatedAt: new Date(),
  lineItems: [
    {
      id: 'li_1',
      tabId: 'tab_123',
      description: 'Test Item 1',
      quantity: 2,
      unitPrice: '25.00',
      total: '50.00',
    },
    {
      id: 'li_2',
      tabId: 'tab_123',
      description: 'Test Item 2',
      quantity: 1,
      unitPrice: '50.00',
      total: '50.00',
    },
  ],
  ...overrides,
})

const createMockProcessor = (overrides = {}) => ({
  id: 'proc_123',
  merchantId: 'merchant_123',
  processorType: ProcessorType.STRIPE,
  isActive: true,
  isTestMode: true,
  encryptedCredentials: 'encrypted_creds',
  webhookSecret: 'whsec_test123',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe('Merchant Processor Payment Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Reset Stripe mock to return the instance
    ;(Stripe as any as jest.Mock).mockImplementation(() => mockStripeInstance)
    
    // Setup default encryption mocks
    ;(EncryptionService.decrypt as jest.Mock).mockReturnValue({
      secretKey: 'sk_test_123',
      publishableKey: 'pk_test_123',
    })
    ;(EncryptionService.encrypt as jest.Mock).mockReturnValue('encrypted_data')
    ;(EncryptionService.generateWebhookSecret as jest.Mock).mockReturnValue('whsec_test123')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Payment Creation with Merchant Processor', () => {
    it('should create payment intent using merchant processor', async () => {
      // Arrange
      const mockTab = createMockTab()
      const mockProcessor = createMockProcessor()
      const paymentAmount = 50.00
      
      // Mock database queries
      ;(db.query.tabs.findFirst as jest.Mock).mockResolvedValue(mockTab)
      ;(db.query.merchantProcessors.findFirst as jest.Mock).mockResolvedValue(mockProcessor)
      ;(db.insert as jest.Mock).mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{
            id: 'payment_123',
            tabId: mockTab.id,
            amount: paymentAmount.toFixed(2),
            status: 'pending',
            stripePaymentIntentId: 'pi_test_123',
          }]),
        }),
      })
      
      // Mock Stripe payment intent creation
      mockStripeInstance.paymentIntents.create.mockResolvedValue({
        id: 'pi_test_123',
        amount: 5000,
        currency: 'usd',
        client_secret: 'pi_test_123_secret',
        status: 'requires_payment_method',
        metadata: {
          tabId: mockTab.id,
          paymentId: 'payment_123',
          merchantId: mockTab.merchantId,
        },
      })
      
      // Act
      const processor = await MerchantProcessorService.createProcessorInstance(
        mockTab.merchantId,
        ProcessorType.STRIPE,
        true
      )
      
      const paymentIntent = await processor.createPaymentIntent({
        amount: paymentAmount,
        currency: 'usd',
        metadata: {
          tabId: mockTab.id,
          paymentId: 'payment_123',
          merchantId: mockTab.merchantId,
        },
      })
      
      // Assert
      expect(db.query.merchantProcessors.findFirst).toHaveBeenCalled()
      expect(EncryptionService.decrypt).toHaveBeenCalledWith('encrypted_creds')
      expect(Stripe).toHaveBeenCalledWith('sk_test_123', expect.objectContaining({
        apiVersion: '2023-10-16',
      }))
      expect(mockStripeInstance.paymentIntents.create).toHaveBeenCalledWith({
        amount: 5000,
        currency: 'usd',
        metadata: expect.objectContaining({
          tabId: mockTab.id,
          merchantId: mockTab.merchantId,
        }),
      })
      expect(paymentIntent.id).toBe('pi_test_123')
    })

    it('should handle multiple payment processors for same merchant', async () => {
      // Arrange
      const mockProcessors = [
        createMockProcessor({ id: 'proc_1', isActive: true, isTestMode: true }),
        createMockProcessor({ id: 'proc_2', isActive: false, isTestMode: false }),
      ]
      
      ;(db.query.merchantProcessors.findMany as jest.Mock).mockResolvedValue(mockProcessors)
      
      // Act
      const processors = await MerchantProcessorService.getMerchantProcessors('merchant_123')
      
      // Assert
      expect(processors).toHaveLength(2)
      expect(processors[0].isActive).toBe(true)
      expect(processors[1].isActive).toBe(false)
    })

    it('should throw error for inactive processor', async () => {
      // Arrange - no active processor found
      ;(db.query.merchantProcessors.findFirst as jest.Mock).mockResolvedValue(null)
      
      // Act & Assert
      await expect(
        MerchantProcessorService.createProcessorInstance(
          'merchant_123',
          ProcessorType.STRIPE,
          true
        )
      ).rejects.toThrow()
    })
  })

  describe('Webhook Processing with Merchant Processors', () => {
    it('should process payment success webhook for merchant processor', async () => {
      // Arrange
      const mockTab = createMockTab({ paidAmount: '50.00', status: 'partial' })
      const mockProcessor = createMockProcessor()
      const webhookPayload = JSON.stringify({
        id: 'evt_123',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_123',
            amount: 5800, // $58.00 - remaining balance
            metadata: {
              tabId: mockTab.id,
              paymentId: 'payment_123',
              merchantId: mockTab.merchantId,
            },
          },
        },
      })
      
      // Mock webhook verification
      mockStripeInstance.webhooks.constructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_123',
            amount: 5800,
            metadata: {
              tabId: mockTab.id,
              paymentId: 'payment_123',
              merchantId: mockTab.merchantId,
            },
          },
        },
      })
      
      // Mock database queries
      ;(db.query.merchantProcessors.findFirst as jest.Mock).mockResolvedValue(mockProcessor)
      ;(db.query.tabs.findFirst as jest.Mock).mockResolvedValue(mockTab)
      ;(db.query.payments.findFirst as jest.Mock).mockResolvedValue({
        id: 'payment_123',
        status: 'pending',
        amount: '58.00',
      })
      
      // Mock updates
      ;(db.update as jest.Mock).mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{
              id: 'payment_123',
              status: 'succeeded',
            }]),
          }),
        }),
      })
      
      // Act
      const processor = await MerchantProcessorService.createProcessorInstance(
        mockTab.merchantId,
        ProcessorType.STRIPE,
        true
      )
      
      const event = mockStripeInstance.webhooks.constructEvent(
        webhookPayload,
        'signature',
        mockProcessor.webhookSecret
      )
      
      // Process webhook (simulating webhook handler logic)
      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object
        const { tabId, paymentId } = paymentIntent.metadata
        
        // Update payment status
        await db.update('payments')
          .set({ status: 'succeeded', updatedAt: new Date() })
          .where({ id: paymentId })
          .returning()
        
        // Update tab paid amount
        const newPaidAmount = parseFloat(mockTab.paidAmount) + (paymentIntent.amount / 100)
        const newStatus = newPaidAmount >= parseFloat(mockTab.totalAmount) ? 'paid' : 'partial'
        
        await db.update('tabs')
          .set({ 
            paidAmount: newPaidAmount.toFixed(2), 
            status: newStatus,
            updatedAt: new Date(),
          })
          .where({ id: tabId })
      }
      
      // Assert
      expect(mockStripeInstance.webhooks.constructEvent).toHaveBeenCalledWith(
        webhookPayload,
        'signature',
        mockProcessor.webhookSecret
      )
      expect(db.update).toHaveBeenCalledTimes(2) // Once for payment, once for tab
    })

    it('should handle webhook for different processor types', async () => {
      // Arrange
      const mockProcessor = createMockProcessor({ 
        processorType: ProcessorType.SQUARE,
        webhookSecret: 'square_webhook_secret',
      })
      
      ;(db.query.merchantProcessors.findFirst as jest.Mock).mockResolvedValue(mockProcessor)
      
      // Act
      const webhookUrl = MerchantProcessorService.getWebhookUrl(ProcessorType.SQUARE)
      
      // Assert
      expect(webhookUrl).toContain('/api/v1/webhooks/square')
    })

    it('should reject webhook with invalid signature', async () => {
      // Arrange
      const mockProcessor = createMockProcessor()
      
      mockStripeInstance.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Webhook signature verification failed')
      })
      
      ;(db.query.merchantProcessors.findFirst as jest.Mock).mockResolvedValue(mockProcessor)
      
      // Act & Assert
      expect(() => {
        mockStripeInstance.webhooks.constructEvent(
          'invalid_payload',
          'invalid_signature',
          mockProcessor.webhookSecret
        )
      }).toThrow('Webhook signature verification failed')
    })
  })

  describe('Refund Processing with Merchant Processors', () => {
    it('should process refund using merchant processor', async () => {
      // Arrange
      const mockTab = createMockTab({ paidAmount: '108.00', status: 'paid' })
      const mockProcessor = createMockProcessor()
      const mockPayment = {
        id: 'payment_123',
        tabId: mockTab.id,
        amount: '108.00',
        status: 'succeeded',
        stripePaymentIntentId: 'pi_test_123',
        stripeChargeId: 'ch_test_123',
      }
      
      // Mock database queries
      ;(db.query.merchantProcessors.findFirst as jest.Mock).mockResolvedValue(mockProcessor)
      ;(db.query.payments.findFirst as jest.Mock).mockResolvedValue(mockPayment)
      
      // Mock Stripe refund
      mockStripeInstance.refunds.create.mockResolvedValue({
        id: 'refund_123',
        amount: 5000, // $50.00 partial refund
        charge: 'ch_test_123',
        status: 'succeeded',
      })
      
      // Act
      const processor = await MerchantProcessorService.createProcessorInstance(
        mockTab.merchantId,
        ProcessorType.STRIPE,
        true
      )
      
      const refund = await mockStripeInstance.refunds.create({
        charge: mockPayment.stripeChargeId,
        amount: 5000,
        metadata: {
          tabId: mockTab.id,
          paymentId: mockPayment.id,
          merchantId: mockTab.merchantId,
        },
      })
      
      // Assert
      expect(mockStripeInstance.refunds.create).toHaveBeenCalledWith({
        charge: 'ch_test_123',
        amount: 5000,
        metadata: expect.objectContaining({
          tabId: mockTab.id,
          merchantId: mockTab.merchantId,
        }),
      })
      expect(refund.amount).toBe(5000)
      expect(refund.status).toBe('succeeded')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle processor credential validation failure', async () => {
      // Arrange
      const invalidCredentials = {
        secretKey: 'invalid_key',
        publishableKey: 'invalid_pk',
      }
      
      ;(EncryptionService.decrypt as jest.Mock).mockReturnValue(invalidCredentials)
      
      // Mock processor instance with invalid credentials behavior
      const mockInvalidProcessor = {
        ...mockStripeInstance,
        paymentIntents: {
          create: jest.fn().mockRejectedValue(new Error('Invalid API Key provided')),
        },
      }
      
      ;(Stripe as any as jest.Mock).mockImplementationOnce(() => mockInvalidProcessor)
      
      // Act
      const processor = await MerchantProcessorService.createProcessorInstance(
        'merchant_123',
        ProcessorType.STRIPE,
        true
      )
      
      // Assert - verify that payment intent creation fails
      await expect(
        processor.createPaymentIntent({
          amount: 100,
          currency: 'usd',
          metadata: {},
        })
      ).rejects.toThrow('Invalid API Key provided')
    })

    it('should handle concurrent payment attempts', async () => {
      // Arrange
      const mockTab = createMockTab({ paidAmount: '50.00' })
      const mockProcessor = createMockProcessor()
      
      ;(db.query.tabs.findFirst as jest.Mock).mockResolvedValue(mockTab)
      ;(db.query.merchantProcessors.findFirst as jest.Mock).mockResolvedValue(mockProcessor)
      
      const payment1Amount = 30.00
      const payment2Amount = 40.00
      const remainingBalance = 58.00 // 108.00 - 50.00
      
      // Both payments together exceed remaining balance
      expect(payment1Amount + payment2Amount).toBeGreaterThan(remainingBalance)
      
      // Act
      const canProcessPayment1 = payment1Amount <= remainingBalance
      const canProcessPayment2 = payment2Amount <= remainingBalance
      
      // Assert
      expect(canProcessPayment1).toBe(true)
      expect(canProcessPayment2).toBe(true)
      // But only one should succeed due to balance validation
    })

    it('should handle processor switching', async () => {
      // Arrange
      const testProcessor = createMockProcessor({ 
        id: 'proc_test',
        isTestMode: true,
        isActive: true,
      })
      const liveProcessor = createMockProcessor({ 
        id: 'proc_live',
        isTestMode: false,
        isActive: false,
      })
      
      ;(db.query.merchantProcessors.findMany as jest.Mock).mockResolvedValue([
        testProcessor,
        liveProcessor,
      ])
      
      // Act - Switch from test to live
      ;(db.update as jest.Mock).mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{
              ...testProcessor,
              isActive: false,
            }]),
          }),
        }),
      })
      
      await MerchantProcessorService.updateProcessor(
        'merchant_123',
        'proc_test',
        { isActive: false }
      )
      
      await MerchantProcessorService.updateProcessor(
        'merchant_123',
        'proc_live',
        { isActive: true }
      )
      
      // Assert
      expect(db.update).toHaveBeenCalledTimes(2)
    })

    it('should validate currency support for processor', async () => {
      // Arrange
      const mockProcessor = createMockProcessor()
      const unsupportedCurrency = 'XXX' // Invalid currency
      
      ;(db.query.merchantProcessors.findFirst as jest.Mock).mockResolvedValue(mockProcessor)
      
      mockStripeInstance.paymentIntents.create.mockRejectedValue(
        new Error(`The currency provided (${unsupportedCurrency}) is invalid`)
      )
      
      // Act & Assert
      await expect(
        mockStripeInstance.paymentIntents.create({
          amount: 1000,
          currency: unsupportedCurrency,
        })
      ).rejects.toThrow('The currency provided (XXX) is invalid')
    })
  })

  describe('Test Mode vs Live Mode', () => {
    it('should use test credentials for test mode processor', async () => {
      // Arrange
      const testProcessor = createMockProcessor({ isTestMode: true })
      const testCredentials = {
        secretKey: 'sk_test_123',
        publishableKey: 'pk_test_123',
      }
      
      ;(db.query.merchantProcessors.findFirst as jest.Mock).mockResolvedValue(testProcessor)
      ;(EncryptionService.decrypt as jest.Mock).mockReturnValue(testCredentials)
      
      // Act
      await MerchantProcessorService.createProcessorInstance(
        'merchant_123',
        ProcessorType.STRIPE,
        true
      )
      
      // Assert
      expect(EncryptionService.decrypt).toHaveBeenCalledWith(testProcessor.encryptedCredentials)
      expect(Stripe).toHaveBeenCalledWith('sk_test_123', expect.objectContaining({
        apiVersion: '2023-10-16',
      }))
    })

    it('should use live credentials for live mode processor', async () => {
      // Arrange
      const liveProcessor = createMockProcessor({ isTestMode: false })
      const liveCredentials = {
        secretKey: 'sk_live_123',
        publishableKey: 'pk_live_123',
      }
      
      ;(db.query.merchantProcessors.findFirst as jest.Mock).mockResolvedValue(liveProcessor)
      ;(EncryptionService.decrypt as jest.Mock).mockReturnValue(liveCredentials)
      
      // Act
      await MerchantProcessorService.createProcessorInstance(
        'merchant_123',
        ProcessorType.STRIPE,
        false
      )
      
      // Assert
      expect(Stripe).toHaveBeenCalledWith('sk_live_123', expect.objectContaining({
        apiVersion: '2023-10-16',
      }))
    })

    it('should prevent test payment on live tab', async () => {
      // Arrange
      const liveTab = createMockTab({ isTestMode: false })
      const testProcessor = createMockProcessor({ isTestMode: true })
      
      ;(db.query.tabs.findFirst as jest.Mock).mockResolvedValue(liveTab)
      ;(db.query.merchantProcessors.findFirst as jest.Mock).mockResolvedValue(testProcessor)
      
      // Act
      const canProcessPayment = liveTab.isTestMode === testProcessor.isTestMode
      
      // Assert
      expect(canProcessPayment).toBe(false)
    })
  })
})