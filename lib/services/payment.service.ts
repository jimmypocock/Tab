/**
 * Payment Service - Handles payment processing and management
 */

import { DITokens } from '@/lib/di/types'
import type { IDIContainer } from '@/lib/di/types'
import { PaymentRepository } from '@/lib/repositories/payment.repository'
import { TabRepository } from '@/lib/repositories/tab.repository'
import { LineItemRepository } from '@/lib/repositories/line-item.repository'
import { BusinessRuleError, ValidationError } from '@/lib/errors'
import Stripe from 'stripe'
import { logger } from '@/lib/logger'

export interface CreatePaymentIntentInput {
  tabId: string
  amount?: number // If not provided, pay full tab amount
  paymentMethodId?: string
  lineItemIds?: string[] // For partial payments
  metadata?: Record<string, string>
}

export interface ProcessPaymentInput {
  paymentIntentId: string
  tabId: string
  organizationId: string
}

export class PaymentService {
  private paymentRepo: PaymentRepository
  private tabRepo: TabRepository
  private lineItemRepo: LineItemRepository
  private stripe: Stripe
  private logger: typeof logger

  constructor(container: IDIContainer) {
    this.paymentRepo = container.resolve(DITokens.PaymentRepository)
    this.tabRepo = container.resolve(DITokens.TabRepository)
    this.lineItemRepo = container.resolve(DITokens.LineItemRepository)
    this.stripe = container.resolve(DITokens.Stripe)
    this.logger = container.resolve(DITokens.Logger)
  }

  /**
   * List payments for an organization
   */
  async listPayments(organizationId: string, options?: any) {
    const payments = await this.paymentRepo.findMany(organizationId, options)
    return {
      data: payments,
      pagination: {
        page: options?.page || 1,
        pageSize: options?.pageSize || 20,
        totalItems: payments.length,
        totalPages: Math.ceil(payments.length / (options?.pageSize || 20))
      }
    }
  }

  /**
   * Create a payment intent for a tab
   */
  async createPaymentIntent(
    organizationId: string,
    input: CreatePaymentIntentInput
  ): Promise<Stripe.PaymentIntent> {
    // Get the tab
    const tab = await this.tabRepo.findById(input.tabId, organizationId)
    if (!tab) {
      throw new ValidationError('Tab not found')
    }

    // Check if tab can be paid
    if (tab.status === 'void') {
      throw new BusinessRuleError('Cannot pay a voided tab')
    }

    if (tab.status === 'paid') {
      throw new BusinessRuleError('Tab is already paid')
    }

    // Calculate amount
    let amountInCents: number
    if (input.amount) {
      amountInCents = Math.round(input.amount * 100)
    } else {
      // Pay remaining balance
      const balance = parseFloat(tab.totalAmount) - parseFloat(tab.paidAmount)
      amountInCents = Math.round(balance * 100)
    }

    if (amountInCents <= 0) {
      throw new BusinessRuleError('Invalid payment amount')
    }

    // Create Stripe payment intent
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amountInCents,
      currency: tab.currency.toLowerCase(),
      metadata: {
        tabId: tab.id,
        organizationId,
        ...(input.metadata || {})
      },
      automatic_payment_methods: {
        enabled: true,
      },
    })

    // Record payment attempt
    await this.paymentRepo.create({
      organizationId,
      tabId: tab.id,
      amount: (amountInCents / 100).toFixed(2),
      currency: tab.currency,
      status: 'pending',
      processor: 'stripe',
      processorPaymentId: paymentIntent.id,
      metadata: {
        lineItemIds: input.lineItemIds,
        paymentMethodId: input.paymentMethodId,
      }
    })

    this.logger.info('Payment intent created', {
      paymentIntentId: paymentIntent.id,
      tabId: tab.id,
      amount: amountInCents,
    })

    return paymentIntent
  }

  /**
   * Process a successful payment
   */
  async processPayment(input: ProcessPaymentInput): Promise<void> {
    // Get payment intent from Stripe
    const paymentIntent = await this.stripe.paymentIntents.retrieve(
      input.paymentIntentId
    )

    if (paymentIntent.status !== 'succeeded') {
      throw new BusinessRuleError('Payment has not succeeded')
    }

    // Find our payment record
    const payment = await this.paymentRepo.findByProcessorPaymentId(
      paymentIntent.id
    )

    if (!payment) {
      throw new ValidationError('Payment record not found')
    }

    // Update payment status
    await this.paymentRepo.update(payment.id, input.organizationId, {
      status: 'succeeded',
      processedAt: new Date(),
      processorResponse: paymentIntent,
    })

    // Update tab paid amount
    const tab = await this.tabRepo.findById(input.tabId, input.organizationId)
    if (!tab) {
      throw new ValidationError('Tab not found')
    }

    const newPaidAmount = parseFloat(tab.paidAmount) + (paymentIntent.amount / 100)
    const totalAmount = parseFloat(tab.totalAmount)
    
    await this.tabRepo.update(input.tabId, input.organizationId, {
      paidAmount: newPaidAmount.toFixed(2),
      status: newPaidAmount >= totalAmount ? 'paid' : 'open',
      paidAt: newPaidAmount >= totalAmount ? new Date() : undefined,
    })

    this.logger.info('Payment processed successfully', {
      paymentId: payment.id,
      tabId: input.tabId,
      amount: paymentIntent.amount / 100,
    })
  }

  /**
   * Create a checkout session for a tab
   */
  async createCheckoutSession(
    organizationId: string,
    tabId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<Stripe.Checkout.Session> {
    const tab = await this.tabRepo.findById(tabId, organizationId, true)
    if (!tab) {
      throw new ValidationError('Tab not found')
    }

    // Create line items for Stripe
    const lineItems = tab.lineItems.map(item => ({
      price_data: {
        currency: tab.currency.toLowerCase(),
        product_data: {
          name: item.description,
          metadata: {
            lineItemId: item.id,
          }
        },
        unit_amount: Math.round(parseFloat(item.unitPrice) * 100),
      },
      quantity: parseInt(item.quantity),
    }))

    // Add tax as a line item
    if (parseFloat(tab.taxAmount) > 0) {
      lineItems.push({
        price_data: {
          currency: tab.currency.toLowerCase(),
          product_data: {
            name: 'Tax',
          },
          unit_amount: Math.round(parseFloat(tab.taxAmount) * 100),
        },
        quantity: 1,
      })
    }

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        tabId: tab.id,
        organizationId,
      },
    })

    // Create payment record
    await this.paymentRepo.create({
      organizationId,
      tabId: tab.id,
      amount: tab.totalAmount,
      currency: tab.currency,
      status: 'pending',
      processor: 'stripe',
      processorPaymentId: session.id,
      metadata: {
        type: 'checkout_session',
      }
    })

    return session
  }

  /**
   * Handle webhook events from payment processors
   */
  async handleStripeWebhook(
    event: Stripe.Event,
    organizationId: string
  ): Promise<void> {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await this.processPayment({
          paymentIntentId: paymentIntent.id,
          tabId: paymentIntent.metadata.tabId,
          organizationId,
        })
        break

      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session
        if (session.payment_status === 'paid') {
          await this.processCheckoutSession(session, organizationId)
        }
        break

      default:
        this.logger.debug('Unhandled webhook event', { type: event.type })
    }
  }

  /**
   * Process a completed checkout session
   */
  private async processCheckoutSession(
    session: Stripe.Checkout.Session,
    organizationId: string
  ): Promise<void> {
    const payment = await this.paymentRepo.findByProcessorPaymentId(session.id)
    if (!payment) {
      this.logger.error('Payment record not found for checkout session', null, {
        sessionId: session.id,
      })
      return
    }

    await this.paymentRepo.update(payment.id, organizationId, {
      status: 'succeeded',
      processedAt: new Date(),
      processorResponse: session,
    })

    // Update tab
    const tab = await this.tabRepo.findById(payment.tabId, organizationId)
    if (tab) {
      await this.tabRepo.update(payment.tabId, organizationId, {
        paidAmount: tab.totalAmount,
        status: 'paid',
        paidAt: new Date(),
      })
    }
  }

  /**
   * Get payment history for a tab
   */
  async getTabPayments(tabId: string, organizationId: string) {
    return this.paymentRepo.findMany(organizationId, { tabId })
  }

  /**
   * Refund a payment
   */
  async refundPayment(
    paymentId: string,
    organizationId: string,
    amount?: number,
    reason?: string
  ): Promise<void> {
    const payment = await this.paymentRepo.findById(paymentId, organizationId)
    if (!payment) {
      throw new ValidationError('Payment not found')
    }

    if (payment.status !== 'succeeded') {
      throw new BusinessRuleError('Can only refund successful payments')
    }

    // Create Stripe refund
    const refund = await this.stripe.refunds.create({
      payment_intent: payment.processorPaymentId,
      amount: amount ? Math.round(amount * 100) : undefined,
      reason: 'requested_by_customer',
      metadata: {
        paymentId: payment.id,
        reason: reason || 'Customer requested',
      }
    })

    // Update payment record
    await this.paymentRepo.update(paymentId, organizationId, {
      status: 'refunded',
      refundedAt: new Date(),
      refundAmount: (refund.amount / 100).toFixed(2),
      metadata: {
        ...payment.metadata,
        refundId: refund.id,
        refundReason: reason,
      }
    })

    // Update tab if fully refunded
    const tab = await this.tabRepo.findById(payment.tabId, organizationId)
    if (tab) {
      const newPaidAmount = parseFloat(tab.paidAmount) - (refund.amount / 100)
      await this.tabRepo.update(payment.tabId, organizationId, {
        paidAmount: newPaidAmount.toFixed(2),
        status: newPaidAmount <= 0 ? 'open' : tab.status,
      })
    }

    this.logger.info('Payment refunded', {
      paymentId,
      refundId: refund.id,
      amount: refund.amount / 100,
    })
  }
}