import Stripe from 'stripe'
import { ProcessorType } from '@/lib/payment-processors/types'
import { logger } from '@/lib/logger'
import { APP_URL } from '@/lib/config/routes'

export interface WebhookConfig {
  url: string
  secret?: string
  events?: string[]
}

export class WebhookConfigService {
  /**
   * Automatically configure webhooks for a payment processor
   */
  static async configureWebhook(
    processorType: ProcessorType,
    credentials: any,
    merchantId: string
  ): Promise<{ webhookSecret: string; webhookId?: string }> {
    switch (processorType) {
      case ProcessorType.STRIPE:
        return this.configureStripeWebhook(credentials, merchantId)
      
      case ProcessorType.SQUARE:
        return this.configureSquareWebhook(credentials, merchantId)
      
      case ProcessorType.PAYPAL:
        // PayPal webhooks are configured at the app level, not per merchant
        return { webhookSecret: this.generateWebhookSecret() }
      
      default:
        // For processors that don't support automatic webhook config
        return { webhookSecret: this.generateWebhookSecret() }
    }
  }

  /**
   * Configure Stripe webhook endpoint automatically
   */
  private static async configureStripeWebhook(
    credentials: { secretKey: string },
    merchantId: string
  ): Promise<{ webhookSecret: string; webhookId: string }> {
    try {
      const stripe = new Stripe(credentials.secretKey, {
        apiVersion: '2023-10-16',
      })

      const webhookUrl = `${APP_URL}/api/v1/webhooks/stripe`
      
      // Check if webhook already exists
      const existingWebhooks = await stripe.webhookEndpoints.list({
        limit: 100,
      })

      const existingWebhook = existingWebhooks.data.find(
        webhook => webhook.url === webhookUrl && webhook.metadata?.merchant_id === merchantId
      )

      if (existingWebhook) {
        // Update existing webhook
        const updated = await stripe.webhookEndpoints.update(existingWebhook.id, {
          enabled_events: [
            'payment_intent.succeeded',
            'payment_intent.payment_failed',
            'charge.refunded',
            'checkout.session.completed',
          ],
        })

        return {
          webhookSecret: '', // Not needed for Stripe - uses env variable
          webhookId: existingWebhook.id,
        }
      }

      // Create new webhook
      const webhook = await stripe.webhookEndpoints.create({
        url: webhookUrl,
        enabled_events: [
          'payment_intent.succeeded',
          'payment_intent.payment_failed',
          'charge.refunded',
          'checkout.session.completed',
        ],
        metadata: {
          merchant_id: merchantId,
        },
      })

      return {
        webhookSecret: '', // Not needed for Stripe - uses env variable
        webhookId: webhook.id,
      }
    } catch (error) {
      logger.error('Failed to configure Stripe webhook', error)
      // Fallback to manual configuration
      return { 
        webhookSecret: '', // Not needed for Stripe - uses env variable
        webhookId: undefined,
      }
    }
  }

  /**
   * Configure Square webhook subscription automatically
   */
  private static async configureSquareWebhook(
    credentials: { accessToken: string; environment: string },
    merchantId: string
  ): Promise<{ webhookSecret: string; webhookId: string }> {
    try {
      const baseUrl = credentials.environment === 'production' 
        ? 'https://connect.squareup.com/v2'
        : 'https://connect.squareupsandbox.com/v2'

      const webhookUrl = `${APP_URL}/api/v1/webhooks/square`
      
      // Create webhook subscription
      const response = await fetch(`${baseUrl}/webhooks/subscriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2023-12-13',
        },
        body: JSON.stringify({
          subscription: {
            name: `Tab Webhook - ${merchantId}`,
            notification_url: webhookUrl,
            event_types: [
              'payment.created',
              'payment.updated',
              'refund.created',
              'refund.updated',
            ],
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`Square API error: ${response.statusText}`)
      }

      const data = await response.json()
      
      return {
        webhookSecret: data.subscription.signature_key,
        webhookId: data.subscription.id,
      }
    } catch (error) {
      logger.error('Failed to configure Square webhook', error)
      // Fallback to manual configuration
      return { 
        webhookSecret: this.generateWebhookSecret(),
        webhookId: undefined,
      }
    }
  }

  /**
   * Verify webhook is properly configured and receiving events
   */
  static async verifyWebhookConfig(
    processorType: ProcessorType,
    credentials: any,
    webhookId?: string
  ): Promise<{ configured: boolean; active: boolean; lastPing?: Date }> {
    switch (processorType) {
      case ProcessorType.STRIPE:
        return this.verifyStripeWebhook(credentials, webhookId)
      
      case ProcessorType.SQUARE:
        return this.verifySquareWebhook(credentials, webhookId)
      
      default:
        // For processors without webhook verification
        return { configured: true, active: true }
    }
  }

  /**
   * Verify Stripe webhook configuration
   */
  private static async verifyStripeWebhook(
    credentials: { secretKey: string },
    webhookId?: string
  ): Promise<{ configured: boolean; active: boolean; lastPing?: Date }> {
    if (!webhookId) {
      return { configured: false, active: false }
    }

    try {
      const stripe = new Stripe(credentials.secretKey, {
        apiVersion: '2023-10-16',
      })

      const webhook = await stripe.webhookEndpoints.retrieve(webhookId)
      
      return {
        configured: true,
        active: webhook.status === 'enabled',
        lastPing: webhook.created ? new Date(webhook.created * 1000) : undefined,
      }
    } catch (error) {
      return { configured: false, active: false }
    }
  }

  /**
   * Verify Square webhook configuration
   */
  private static async verifySquareWebhook(
    credentials: { accessToken: string; environment: string },
    webhookId?: string
  ): Promise<{ configured: boolean; active: boolean; lastPing?: Date }> {
    if (!webhookId) {
      return { configured: false, active: false }
    }

    try {
      const baseUrl = credentials.environment === 'production' 
        ? 'https://connect.squareup.com/v2'
        : 'https://connect.squareupsandbox.com/v2'

      const response = await fetch(`${baseUrl}/webhooks/subscriptions/${webhookId}`, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Square-Version': '2023-12-13',
        },
      })

      if (!response.ok) {
        return { configured: false, active: false }
      }

      const data = await response.json()
      
      return {
        configured: true,
        active: data.subscription.enabled,
        lastPing: data.subscription.updated_at ? new Date(data.subscription.updated_at) : undefined,
      }
    } catch (error) {
      return { configured: false, active: false }
    }
  }

  /**
   * Generate a secure webhook secret for manual configuration
   */
  private static generateWebhookSecret(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let secret = 'whsec_' // Stripe-like prefix for consistency
    
    for (let i = 0; i < 32; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    
    return secret
  }
}