// Centralized route configuration
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:1235')

export const API_ROUTES = {
  // Public API routes
  public: {
    tab: (id: string) => `/api/v1/public/tabs/${id}`,
    checkoutSession: '/api/v1/public/checkout-session',
    paymentIntent: '/api/v1/public/payment-intent',
  },
  
  // Authenticated API routes
  tabs: {
    list: '/api/v1/tabs',
    detail: (id: string) => `/api/v1/tabs/${id}`,
  },
  
  lineItems: {
    list: '/api/v1/line-items',
    detail: (id: string) => `/api/v1/line-items/${id}`,
  },
  
  payments: {
    list: '/api/v1/payments',
    detail: (id: string) => `/api/v1/payments/${id}`,
  },
  
  merchant: {
    processors: {
      list: '/api/v1/merchant/processors',
      detail: (id: string) => `/api/v1/merchant/processors/${id}`,
    },
  },
  
  webhooks: {
    stripe: '/api/v1/webhooks/stripe',
    processor: (type: string) => `/api/v1/webhooks/${type}`,
  },
} as const

// Helper function to get full URLs for webhooks
export const getWebhookUrl = (processorType: string): string => {
  return `${APP_URL}${API_ROUTES.webhooks.processor(processorType)}`
}

// Helper to build API URLs with base URL
export const getApiUrl = (path: string): string => {
  return `${APP_URL}${path}`
}