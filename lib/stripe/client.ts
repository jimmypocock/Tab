import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
})

export async function createPaymentIntent(
  amount: number,
  currency: string = 'usd',
  metadata?: Record<string, string>
) {
  return stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to cents
    currency,
    metadata,
    automatic_payment_methods: {
      enabled: true,
    },
  })
}

export async function confirmPaymentIntent(
  paymentIntentId: string,
  paymentMethodId: string
) {
  return stripe.paymentIntents.confirm(paymentIntentId, {
    payment_method: paymentMethodId,
  })
}

export async function retrievePaymentIntent(paymentIntentId: string) {
  return stripe.paymentIntents.retrieve(paymentIntentId)
}

export async function createCustomer(email: string, metadata?: Record<string, string>) {
  return stripe.customers.create({
    email,
    metadata,
  })
}

export async function attachPaymentMethod(
  paymentMethodId: string,
  customerId: string
) {
  return stripe.paymentMethods.attach(paymentMethodId, {
    customer: customerId,
  })
}