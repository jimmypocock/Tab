import { z } from 'zod'

// Supported processor types
export const ProcessorType = {
  STRIPE: 'stripe',
  SQUARE: 'square',
  PAYPAL: 'paypal',
  AUTHORIZE_NET: 'authorize_net',
} as const

export type ProcessorType = typeof ProcessorType[keyof typeof ProcessorType]

// Common payment intents across all processors
export interface PaymentIntent {
  id: string
  amount: number
  currency: string
  status: PaymentStatus
  processorPaymentId: string
  metadata?: Record<string, any>
}

export interface CheckoutSession {
  id: string
  url: string
  amount: number
  currency: string
  status: PaymentStatus
  processorSessionId: string
  successUrl: string
  cancelUrl: string
  metadata?: Record<string, any>
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELED = 'canceled',
  REFUNDED = 'refunded',
}

// Webhook event types (normalized across processors)
export enum WebhookEventType {
  PAYMENT_SUCCEEDED = 'payment.succeeded',
  PAYMENT_FAILED = 'payment.failed',
  CHECKOUT_COMPLETED = 'checkout.completed',
  CHECKOUT_EXPIRED = 'checkout.expired',
  REFUND_CREATED = 'refund.created',
  REFUND_UPDATED = 'refund.updated',
}

export interface WebhookEvent {
  id: string
  type: WebhookEventType
  data: any
  processorEvent: any // Original event from processor
}

// Processor credentials schemas
export const stripeCredentialsSchema = z.object({
  secretKey: z.string().min(1),
  publishableKey: z.string().min(1),
  webhookSecret: z.string().optional(),
})

export const squareCredentialsSchema = z.object({
  accessToken: z.string().min(1),
  applicationId: z.string().min(1),
  locationId: z.string().min(1),
  webhookSignatureKey: z.string().optional(),
})

export const paypalCredentialsSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  webhookId: z.string().optional(),
})

export const authorizeNetCredentialsSchema = z.object({
  loginId: z.string().min(1),
  transactionKey: z.string().min(1),
  signatureKey: z.string().optional(),
})

// Map processor types to their credential schemas
export const processorCredentialSchemas = {
  [ProcessorType.STRIPE]: stripeCredentialsSchema,
  [ProcessorType.SQUARE]: squareCredentialsSchema,
  [ProcessorType.PAYPAL]: paypalCredentialsSchema,
  [ProcessorType.AUTHORIZE_NET]: authorizeNetCredentialsSchema,
} as const

// Processor configuration
export interface ProcessorConfig {
  processorType: ProcessorType
  isTestMode: boolean
  credentials: z.infer<typeof processorCredentialSchemas[ProcessorType]>
  webhookSecret?: string
}

// Error types
export class ProcessorError extends Error {
  constructor(
    message: string,
    public code: string,
    public processorType: ProcessorType,
    public originalError?: any
  ) {
    super(message)
    this.name = 'ProcessorError'
  }
}

export class ProcessorNotFoundError extends Error {
  constructor(processorType: ProcessorType) {
    super(`Payment processor not found: ${processorType}`)
    this.name = 'ProcessorNotFoundError'
  }
}

export class ProcessorConfigurationError extends Error {
  constructor(message: string, public processorType: ProcessorType) {
    super(message)
    this.name = 'ProcessorConfigurationError'
  }
}