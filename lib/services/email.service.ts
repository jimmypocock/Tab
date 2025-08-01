/**
 * Email Service
 */

import { Resend } from 'resend'
import { logger } from '@/lib/logger'

export interface EmailOptions {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  from?: string
  replyTo?: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
  }>
}

export class EmailService {
  private resend: Resend
  private defaultFrom: string

  constructor(private log: typeof logger) {
    this.resend = new Resend(process.env.RESEND_API_KEY)
    this.defaultFrom = process.env.EMAIL_FROM || 'noreply@tabapp.com'
  }

  /**
   * Send an email
   */
  async send(options: EmailOptions): Promise<void> {
    try {
      const { data, error } = await this.resend.emails.send({
        from: options.from || this.defaultFrom,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo,
        attachments: options.attachments,
      })

      if (error) {
        throw error
      }

      this.log.info('Email sent', {
        emailId: data?.id,
        to: options.to,
        subject: options.subject,
      })
    } catch (error) {
      this.log.error('Failed to send email', error as Error, {
        to: options.to,
        subject: options.subject,
      })
      throw error
    }
  }

  /**
   * Send tab invoice email
   */
  async sendTabInvoice(tab: any, recipientEmail: string): Promise<void> {
    const html = `
      <h2>Invoice for Tab #${tab.id}</h2>
      <p>Dear ${tab.customerName || 'Customer'},</p>
      <p>Please find below the details of your tab:</p>
      
      <table>
        <tr>
          <td><strong>Tab ID:</strong></td>
          <td>${tab.id}</td>
        </tr>
        <tr>
          <td><strong>Total Amount:</strong></td>
          <td>${tab.currency} ${tab.totalAmount}</td>
        </tr>
        <tr>
          <td><strong>Status:</strong></td>
          <td>${tab.status}</td>
        </tr>
      </table>
      
      <h3>Line Items:</h3>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Quantity</th>
            <th>Unit Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${tab.lineItems?.map((item: any) => `
            <tr>
              <td>${item.description}</td>
              <td>${item.quantity}</td>
              <td>${tab.currency} ${item.unitPrice}</td>
              <td>${tab.currency} ${item.totalPrice}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/pay/${tab.id}">Pay Now</a></p>
    `

    await this.send({
      to: recipientEmail,
      subject: `Invoice for Tab #${tab.id}`,
      html,
      replyTo: 'support@tabapp.com',
    })
  }

  /**
   * Send payment confirmation
   */
  async sendPaymentConfirmation(payment: any, recipientEmail: string): Promise<void> {
    const html = `
      <h2>Payment Confirmation</h2>
      <p>Your payment has been successfully processed.</p>
      
      <table>
        <tr>
          <td><strong>Payment ID:</strong></td>
          <td>${payment.id}</td>
        </tr>
        <tr>
          <td><strong>Amount:</strong></td>
          <td>${payment.currency} ${payment.amount}</td>
        </tr>
        <tr>
          <td><strong>Date:</strong></td>
          <td>${new Date(payment.createdAt).toLocaleString()}</td>
        </tr>
      </table>
      
      <p>Thank you for your payment!</p>
    `

    await this.send({
      to: recipientEmail,
      subject: 'Payment Confirmation',
      html,
    })
  }
}