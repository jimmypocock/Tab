import crypto from 'crypto'

interface WebhookEvent {
  id: string
  type: string
  data: {
    object: any
  }
  created?: number
  livemode?: boolean
  pending_webhooks?: number
  request?: {
    id: string | null
    idempotency_key: string | null
  }
  api_version?: string
}

/**
 * Creates a properly signed Stripe webhook payload for testing
 * @param event The webhook event object
 * @param secret The webhook secret (e.g., 'whsec_test_secret')
 * @returns Object with payload string and signature header
 */
export function createStripeWebhookSignature(
  event: WebhookEvent, 
  secret: string
): { payload: string; signature: string } {
  // Ensure event has required fields
  const completeEvent = {
    id: event.id || `evt_test_${Date.now()}`,
    object: 'event',
    api_version: '2023-10-16',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null,
    },
    ...event,
  }

  const payload = JSON.stringify(completeEvent)
  const timestamp = Math.floor(Date.now() / 1000)
  
  // Extract secret from webhook signing secret format
  const secretKey = secret.startsWith('whsec_') ? secret.slice(6) : secret
  
  // Create the signed payload string
  const signedPayload = `${timestamp}.${payload}`
  
  // Generate the signature
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(signedPayload)
    .digest('hex')
  
  // Return the signature in Stripe's format
  const signatureHeader = `t=${timestamp},v1=${signature}`
  
  return {
    payload,
    signature: signatureHeader
  }
}

/**
 * Creates a checkout.session.completed webhook event
 */
export function createCheckoutSessionCompletedEvent(params: {
  sessionId?: string
  tabId: string
  amount: number
  currency?: string
  paymentIntentId?: string
  customerEmail?: string
}): WebhookEvent {
  return {
    id: `evt_test_${Date.now()}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: params.sessionId || `cs_test_${Date.now()}`,
        object: 'checkout.session',
        amount_total: params.amount * 100, // Convert to cents
        currency: params.currency || 'usd',
        customer_email: params.customerEmail || 'test@example.com',
        payment_intent: params.paymentIntentId || `pi_test_${Date.now()}`,
        payment_status: 'paid',
        status: 'complete',
        metadata: {
          tabId: params.tabId,
          amount: params.amount.toString(),
        },
      }
    }
  }
}

/**
 * Creates a payment_intent.succeeded webhook event
 */
export function createPaymentIntentSucceededEvent(params: {
  paymentIntentId: string
  amount: number
  currency?: string
  tabId?: string
  merchantId?: string
}): WebhookEvent {
  return {
    id: `evt_test_${Date.now()}`,
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: params.paymentIntentId,
        object: 'payment_intent',
        amount: params.amount * 100, // Convert to cents
        currency: params.currency || 'usd',
        status: 'succeeded',
        charges: {
          object: 'list',
          data: [{
            id: `ch_test_${Date.now()}`,
            object: 'charge',
            amount: params.amount * 100,
            receipt_url: 'https://receipt.stripe.com/test',
          }],
        },
        metadata: params.tabId ? {
          tabId: params.tabId,
          merchantId: params.merchantId,
        } : {},
      }
    }
  }
}

/**
 * Creates a payment_intent.payment_failed webhook event
 */
export function createPaymentIntentFailedEvent(params: {
  paymentIntentId: string
  amount: number
  failureCode?: string
  failureMessage?: string
}): WebhookEvent {
  return {
    id: `evt_test_${Date.now()}`,
    type: 'payment_intent.payment_failed',
    data: {
      object: {
        id: params.paymentIntentId,
        object: 'payment_intent',
        amount: params.amount * 100,
        status: 'requires_payment_method',
        last_payment_error: {
          code: params.failureCode || 'card_declined',
          message: params.failureMessage || 'Your card was declined.',
          type: 'card_error',
        },
      }
    }
  }
}

/**
 * Creates a charge.refunded webhook event
 */
export function createChargeRefundedEvent(params: {
  chargeId: string
  paymentIntentId: string
  originalAmount: number
  refundAmount: number
  currency?: string
  fullRefund?: boolean
}): WebhookEvent {
  return {
    id: `evt_test_${Date.now()}`,
    type: 'charge.refunded',
    data: {
      object: {
        id: params.chargeId,
        object: 'charge',
        amount: params.originalAmount * 100,
        amount_refunded: params.refundAmount * 100,
        currency: params.currency || 'usd',
        payment_intent: params.paymentIntentId,
        refunded: params.fullRefund ?? (params.refundAmount === params.originalAmount),
        refunds: {
          object: 'list',
          data: [{
            id: `re_test_${Date.now()}`,
            amount: params.refundAmount * 100,
            currency: params.currency || 'usd',
            status: 'succeeded',
          }],
        },
      }
    }
  }
}

/**
 * Creates a charge.dispute.created webhook event
 */
export function createChargeDisputeCreatedEvent(params: {
  disputeId?: string
  chargeId: string
  paymentIntentId: string
  amount: number
  reason?: string
}): WebhookEvent {
  return {
    id: `evt_test_${Date.now()}`,
    type: 'charge.dispute.created',
    data: {
      object: {
        id: params.disputeId || `dp_test_${Date.now()}`,
        object: 'dispute',
        amount: params.amount * 100,
        charge: params.chargeId,
        payment_intent: params.paymentIntentId,
        reason: params.reason || 'fraudulent',
        status: 'warning_needs_response',
      }
    }
  }
}