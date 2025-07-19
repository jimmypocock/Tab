import Stripe from 'stripe'
import { 
  BasePaymentProcessor, 
  CreatePaymentIntentParams, 
  CreateCheckoutSessionParams,
  RefundParams,
  RefundResult,
} from '../interface'
import { 
  PaymentIntent, 
  CheckoutSession, 
  WebhookEvent,
  ProcessorConfig,
  ProcessorType,
  PaymentStatus,
  WebhookEventType,
  ProcessorError,
  stripeCredentialsSchema,
} from '../types'

export class StripeProcessor extends BasePaymentProcessor {
  readonly processorType = ProcessorType.STRIPE
  private stripe: Stripe

  constructor(config: ProcessorConfig) {
    super(config)
    
    // Validate credentials
    const credentials = stripeCredentialsSchema.parse(config.credentials)
    
    this.stripe = new Stripe(credentials.secretKey, {
      apiVersion: '2023-10-16',
      typescript: true,
    })
  }

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent> {
    try {
      const intent = await this.stripe.paymentIntents.create({
        amount: Math.round(params.amount * 100), // Convert to cents
        currency: params.currency.toLowerCase(),
        description: params.description,
        metadata: params.metadata || {},
        ...(params.customerId && { customer: params.customerId }),
      })

      return {
        id: intent.id,
        amount: intent.amount / 100,
        currency: intent.currency.toUpperCase(),
        status: this.mapStripeStatus(intent.status),
        processorPaymentId: intent.id,
        metadata: intent.metadata,
      }
    } catch (error: any) {
      throw new ProcessorError(
        error.message || 'Failed to create payment intent',
        error.code || 'stripe_error',
        this.processorType,
        error
      )
    }
  }

  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSession> {
    try {
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ['card'],
        mode: 'payment',
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: params.metadata || {},
        ...(params.customerEmail && { customer_email: params.customerEmail }),
      }

      // Use line items if provided, otherwise use amount
      if (params.lineItems && params.lineItems.length > 0) {
        sessionParams.line_items = params.lineItems.map(item => ({
          price_data: {
            currency: params.currency.toLowerCase(),
            product_data: {
              name: item.name,
            },
            unit_amount: Math.round(item.amount * 100),
          },
          quantity: item.quantity,
        }))
      } else {
        sessionParams.line_items = [{
          price_data: {
            currency: params.currency.toLowerCase(),
            product_data: {
              name: 'Payment',
            },
            unit_amount: Math.round(params.amount * 100),
          },
          quantity: 1,
        }]
      }

      const session = await this.stripe.checkout.sessions.create(sessionParams)

      return {
        id: session.id,
        url: session.url!,
        amount: params.amount,
        currency: params.currency.toUpperCase(),
        status: this.mapCheckoutStatus(session.status),
        processorSessionId: session.id,
        successUrl: params.successUrl,
        cancelUrl: params.cancelUrl,
        metadata: session.metadata || undefined,
      }
    } catch (error: any) {
      throw new ProcessorError(
        error.message || 'Failed to create checkout session',
        error.code || 'stripe_error',
        this.processorType,
        error
      )
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentIntent> {
    try {
      const intent = await this.stripe.paymentIntents.retrieve(paymentId)
      
      return {
        id: intent.id,
        amount: intent.amount / 100,
        currency: intent.currency.toUpperCase(),
        status: this.mapStripeStatus(intent.status),
        processorPaymentId: intent.id,
        metadata: intent.metadata,
      }
    } catch (error: any) {
      throw new ProcessorError(
        error.message || 'Failed to get payment status',
        error.code || 'stripe_error',
        this.processorType,
        error
      )
    }
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: params.paymentId,
        ...(params.amount && { amount: Math.round(params.amount * 100) }),
        ...(params.reason && { reason: this.mapRefundReason(params.reason) }),
      })

      return {
        id: refund.id,
        amount: refund.amount / 100,
        status: refund.status === 'succeeded' ? 'succeeded' : 
                refund.status === 'pending' ? 'pending' : 'failed',
        reason: params.reason,
      }
    } catch (error: any) {
      throw new ProcessorError(
        error.message || 'Failed to process refund',
        error.code || 'stripe_error',
        this.processorType,
        error
      )
    }
  }

  async constructWebhookEvent(payload: string | Buffer, signature: string): Promise<WebhookEvent> {
    try {
      if (!this.config.webhookSecret) {
        throw new Error('Webhook secret not configured')
      }

      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.config.webhookSecret
      )

      // Map Stripe event to our normalized event
      const type = this.mapWebhookEventType(event.type)
      
      return {
        id: event.id,
        type,
        data: event.data.object,
        processorEvent: event,
      }
    } catch (error: any) {
      throw new ProcessorError(
        'Invalid webhook signature',
        'webhook_validation_failed',
        this.processorType,
        error
      )
    }
  }

  async handleWebhook(_event: WebhookEvent): Promise<void> {
    // This will be handled by the webhook service
    // The processor just validates and normalizes the event
  }

  async validateCredentials(): Promise<boolean> {
    try {
      // Make a simple API call to validate the credentials
      await this.stripe.paymentIntents.list({ limit: 1 })
      return true
    } catch (error) {
      return false
    }
  }

  async createCustomer(email: string, metadata?: Record<string, any>): Promise<{ id: string }> {
    try {
      const customer = await this.stripe.customers.create({
        email,
        metadata: metadata || {},
      })
      
      return { id: customer.id }
    } catch (error: any) {
      throw new ProcessorError(
        error.message || 'Failed to create customer',
        error.code || 'stripe_error',
        this.processorType,
        error
      )
    }
  }

  // Helper methods
  private mapStripeStatus(status: Stripe.PaymentIntent.Status): PaymentStatus {
    switch (status) {
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
        return PaymentStatus.PENDING
      case 'processing':
        return PaymentStatus.PROCESSING
      case 'succeeded':
        return PaymentStatus.SUCCEEDED
      case 'canceled':
        return PaymentStatus.CANCELED
      default:
        return PaymentStatus.FAILED
    }
  }

  private mapCheckoutStatus(status: Stripe.Checkout.Session.Status | null): PaymentStatus {
    switch (status) {
      case 'complete':
        return PaymentStatus.SUCCEEDED
      case 'expired':
        return PaymentStatus.CANCELED
      case 'open':
        return PaymentStatus.PENDING
      default:
        return PaymentStatus.PENDING
    }
  }

  private mapWebhookEventType(stripeType: string): WebhookEventType {
    switch (stripeType) {
      case 'payment_intent.succeeded':
        return WebhookEventType.PAYMENT_SUCCEEDED
      case 'payment_intent.payment_failed':
        return WebhookEventType.PAYMENT_FAILED
      case 'checkout.session.completed':
        return WebhookEventType.CHECKOUT_COMPLETED
      case 'checkout.session.expired':
        return WebhookEventType.CHECKOUT_EXPIRED
      case 'charge.refunded':
        return WebhookEventType.REFUND_CREATED
      case 'charge.refund.updated':
        return WebhookEventType.REFUND_UPDATED
      default:
        // Return the original type if we don't have a mapping
        return stripeType as WebhookEventType
    }
  }

  private mapRefundReason(reason: string): Stripe.RefundCreateParams.Reason {
    switch (reason.toLowerCase()) {
      case 'duplicate':
        return 'duplicate'
      case 'fraudulent':
        return 'fraudulent'
      default:
        return 'requested_by_customer'
    }
  }
}