import { 
  PaymentIntent, 
  CheckoutSession, 
  WebhookEvent,
  ProcessorConfig,
} from './types'

export interface CreatePaymentIntentParams {
  amount: number
  currency: string
  description?: string
  metadata?: Record<string, any>
  customerId?: string
}

export interface CreateCheckoutSessionParams {
  amount: number
  currency: string
  successUrl: string
  cancelUrl: string
  customerEmail?: string
  lineItems?: Array<{
    name: string
    amount: number
    quantity: number
  }>
  metadata?: Record<string, any>
}

export interface RefundParams {
  paymentId: string
  amount?: number // Optional for partial refunds
  reason?: string
}

export interface RefundResult {
  id: string
  amount: number
  status: 'succeeded' | 'pending' | 'failed'
  reason?: string
}

export interface IPaymentProcessor {
  // Configuration
  readonly processorType: string
  readonly isTestMode: boolean
  
  // Core payment methods
  createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent>
  createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSession>
  getPaymentStatus(paymentId: string): Promise<PaymentIntent>
  refund(params: RefundParams): Promise<RefundResult>
  
  // Webhook handling
  constructWebhookEvent(payload: string | Buffer, signature: string): Promise<WebhookEvent>
  handleWebhook(event: WebhookEvent): Promise<void>
  
  // Customer management (optional)
  createCustomer?(email: string, metadata?: Record<string, any>): Promise<{ id: string }>
  
  // Validation
  validateCredentials(): Promise<boolean>
}

// Base abstract class for payment processors
export abstract class BasePaymentProcessor implements IPaymentProcessor {
  abstract readonly processorType: string
  
  constructor(protected config: ProcessorConfig) {}
  
  get isTestMode(): boolean {
    return this.config.isTestMode
  }
  
  abstract createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent>
  abstract createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSession>
  abstract getPaymentStatus(paymentId: string): Promise<PaymentIntent>
  abstract refund(params: RefundParams): Promise<RefundResult>
  abstract constructWebhookEvent(payload: string | Buffer, signature: string): Promise<WebhookEvent>
  abstract handleWebhook(event: WebhookEvent): Promise<void>
  abstract validateCredentials(): Promise<boolean>
}