import { WebhookConfigService } from '@/lib/services/webhook-config.service'
import { ProcessorType } from '@/lib/payment-processors/types'

describe('WebhookConfigService Unit Tests', () => {
  describe('generateWebhookSecret', () => {
    it('should generate a valid webhook secret', () => {
      // Access private method through any type
      const service = WebhookConfigService as any
      const secret = service.generateWebhookSecret()
      
      expect(secret).toMatch(/^whsec_[A-Za-z0-9]{32}$/)
      expect(secret).toHaveLength(38) // whsec_ (6) + 32 chars
    })
  })

  describe('configureWebhook', () => {
    it('should handle PayPal configuration', async () => {
      const result = await WebhookConfigService.configureWebhook(
        ProcessorType.PAYPAL,
        { clientId: 'test', clientSecret: 'test' },
        'merchant123'
      )
      
      expect(result.webhookSecret).toMatch(/^whsec_[A-Za-z0-9]{32}$/)
      expect(result.webhookId).toBeUndefined()
    })

    it('should handle unsupported processor types', async () => {
      const result = await WebhookConfigService.configureWebhook(
        'unsupported' as ProcessorType,
        {},
        'merchant123'
      )
      
      expect(result.webhookSecret).toMatch(/^whsec_[A-Za-z0-9]{32}$/)
      expect(result.webhookId).toBeUndefined()
    })
  })

  describe('verifyWebhookConfig', () => {
    it('should return not configured when webhookId is missing', async () => {
      const result = await WebhookConfigService.verifyWebhookConfig(
        ProcessorType.STRIPE,
        { secretKey: 'sk_test_123' },
        undefined
      )
      
      expect(result).toEqual({
        configured: false,
        active: false,
      })
    })

    it('should handle unsupported processor verification', async () => {
      const result = await WebhookConfigService.verifyWebhookConfig(
        ProcessorType.PAYPAL,
        {},
        'webhook123'
      )
      
      expect(result).toEqual({
        configured: true,
        active: true,
      })
    })
  })
})