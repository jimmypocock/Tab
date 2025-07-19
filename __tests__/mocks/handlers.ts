import { http, HttpResponse } from 'msw'

// Define handlers for API endpoints
export const handlers = [
  // Tabs endpoints
  http.get('/api/v1/tabs', ({ request }) => {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '10')
    const search = url.searchParams.get('search') || ''
    const status = url.searchParams.get('status') || ''

    // Mock tabs data
    let tabs = [
      {
        id: 'tab_1',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        totalAmount: '100.00',
        paidAmount: '50.00',
        status: 'partial',
        createdAt: new Date('2024-01-01').toISOString(),
      },
      {
        id: 'tab_2',
        customerName: 'Jane Smith',
        customerEmail: 'jane@example.com',
        totalAmount: '200.00',
        paidAmount: '200.00',
        status: 'paid',
        createdAt: new Date('2024-01-02').toISOString(),
      },
      {
        id: 'tab_3',
        customerName: 'Bob Johnson',
        customerEmail: 'bob@example.com',
        totalAmount: '150.00',
        paidAmount: '0.00',
        status: 'open',
        createdAt: new Date('2024-01-03').toISOString(),
      },
    ]

    // Apply filters
    if (search) {
      tabs = tabs.filter(tab => 
        tab.customerName.toLowerCase().includes(search.toLowerCase()) ||
        tab.customerEmail.toLowerCase().includes(search.toLowerCase())
      )
    }

    if (status) {
      tabs = tabs.filter(tab => tab.status === status)
    }

    // Pagination
    const start = (page - 1) * limit
    const paginatedTabs = tabs.slice(start, start + limit)

    return HttpResponse.json({
      data: paginatedTabs,
      pagination: {
        page,
        limit,
        total: tabs.length,
        totalPages: Math.ceil(tabs.length / limit),
      },
    })
  }),

  http.get('/api/v1/tabs/:id', ({ params }) => {
    const { id } = params

    const tab = {
      id,
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      totalAmount: '100.00',
      paidAmount: '50.00',
      status: 'partial',
      currency: 'USD',
      lineItems: [
        {
          id: 'item_1',
          description: 'Product 1',
          quantity: 2,
          unitPrice: '25.00',
          total: '50.00',
        },
        {
          id: 'item_2',
          description: 'Product 2',
          quantity: 1,
          unitPrice: '50.00',
          total: '50.00',
        },
      ],
      payments: [
        {
          id: 'payment_1',
          amount: '50.00',
          status: 'succeeded',
          paymentMethod: 'card',
          createdAt: new Date('2024-01-02').toISOString(),
        },
      ],
      createdAt: new Date('2024-01-01').toISOString(),
      updatedAt: new Date('2024-01-02').toISOString(),
    }

    return HttpResponse.json({ data: tab })
  }),

  http.post('/api/v1/tabs', async ({ request }) => {
    const body = await request.json() as any

    const newTab = {
      id: `tab_${Date.now()}`,
      ...body,
      totalAmount: body.totalAmount || '0.00',
      paidAmount: '0.00',
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    return HttpResponse.json({ data: newTab }, { status: 201 })
  }),

  http.patch('/api/v1/tabs/:id', async ({ params, request }) => {
    const { id } = params
    const updates = await request.json()

    const updatedTab = {
      id,
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    return HttpResponse.json({ data: updatedTab })
  }),

  http.delete('/api/v1/tabs/:id', ({ params }) => {
    return HttpResponse.json({ success: true })
  }),

  // Line items endpoints
  http.get('/api/v1/line-items', ({ request }) => {
    const url = new URL(request.url)
    const tabId = url.searchParams.get('tabId')

    const lineItems = [
      {
        id: 'item_1',
        tabId,
        description: 'Product 1',
        quantity: 2,
        unitPrice: '25.00',
        total: '50.00',
      },
      {
        id: 'item_2',
        tabId,
        description: 'Product 2',
        quantity: 1,
        unitPrice: '50.00',
        total: '50.00',
      },
    ]

    return HttpResponse.json({ data: lineItems })
  }),

  http.post('/api/v1/line-items', async ({ request }) => {
    const body = await request.json() as any

    const newItem = {
      id: `item_${Date.now()}`,
      ...body,
      total: (body.quantity * parseFloat(body.unitPrice)).toFixed(2),
    }

    return HttpResponse.json({ data: newItem }, { status: 201 })
  }),

  // Payments endpoints
  http.get('/api/v1/payments', ({ request }) => {
    const url = new URL(request.url)
    const tabId = url.searchParams.get('tabId')

    const payments = [
      {
        id: 'payment_1',
        tabId,
        amount: '50.00',
        status: 'succeeded',
        paymentMethod: 'card',
        stripePaymentIntentId: 'pi_test_123',
        createdAt: new Date('2024-01-02').toISOString(),
      },
    ]

    return HttpResponse.json({ data: payments })
  }),

  http.post('/api/v1/payments', async ({ request }) => {
    const body = await request.json() as any

    const newPayment = {
      id: `payment_${Date.now()}`,
      ...body,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }

    return HttpResponse.json({ data: newPayment }, { status: 201 })
  }),

  // Public endpoints
  http.get('/api/v1/public/tabs/:id', ({ params }) => {
    const { id } = params

    const publicTab = {
      id,
      customerEmail: 'john@example.com',
      customerName: 'John Doe',
      totalAmount: '100.00',
      paidAmount: '50.00',
      status: 'partial',
      lineItems: [
        {
          description: 'Product 1',
          quantity: 2,
          unitPrice: '25.00',
          total: '50.00',
        },
        {
          description: 'Product 2',
          quantity: 1,
          unitPrice: '50.00',
          total: '50.00',
        },
      ],
      merchant: {
        businessName: 'Test Business',
      },
    }

    return HttpResponse.json({ data: publicTab })
  }),

  http.post('/api/v1/public/checkout-session', async ({ request }) => {
    const body = await request.json() as any

    return HttpResponse.json({
      data: {
        sessionId: 'cs_test_123',
        url: `https://checkout.stripe.com/test_${Date.now()}`,
      },
    })
  }),

  http.post('/api/v1/public/public-intent', async ({ request }) => {
    const body = await request.json() as any

    return HttpResponse.json({
      data: {
        clientSecret: 'pi_test_secret_123',
        paymentIntentId: 'pi_test_123',
      },
    })
  }),

  http.get('/api/v1/public/verify-payment', ({ request }) => {
    const url = new URL(request.url)
    const sessionId = url.searchParams.get('session_id')

    return HttpResponse.json({
      session: {
        id: sessionId,
        amount_total: 10000,
        customer_email: 'test@example.com',
        payment_status: 'paid',
      },
    })
  }),

  // Webhook endpoints
  http.post('/api/v1/webhooks/stripe', async ({ request }) => {
    // For testing webhooks
    return HttpResponse.json({ received: true })
  }),

  // Dashboard endpoints
  http.get('/api/v1/dashboard/stats', () => {
    return HttpResponse.json({
      data: {
        totalTabs: 25,
        activeTabs: 10,
        totalRevenue: '5000.00',
        pendingPayments: '1500.00',
        recentActivity: [
          {
            id: '1',
            type: 'payment',
            description: 'Payment received for Tab #1',
            amount: '100.00',
            timestamp: new Date().toISOString(),
          },
          {
            id: '2',
            type: 'tab_created',
            description: 'New tab created for John Doe',
            timestamp: new Date().toISOString(),
          },
        ],
      },
    })
  }),

  // Settings endpoints
  http.get('/api/v1/settings', () => {
    return HttpResponse.json({
      data: {
        businessName: 'Test Business',
        businessEmail: 'test@business.com',
        currency: 'USD',
        webhookUrl: 'https://example.com/webhook',
        emailNotifications: true,
      },
    })
  }),

  http.patch('/api/v1/settings', async ({ request }) => {
    const updates = await request.json()

    return HttpResponse.json({
      data: {
        businessName: 'Test Business',
        businessEmail: 'test@business.com',
        currency: 'USD',
        webhookUrl: 'https://example.com/webhook',
        emailNotifications: true,
        ...updates,
      },
    })
  }),
]

// Error response handlers for testing error states
export const errorHandlers = {
  serverError: http.get('/api/v1/*', () => {
    return HttpResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }),

  notFound: http.get('/api/v1/*', () => {
    return HttpResponse.json(
      { error: 'Resource not found' },
      { status: 404 }
    )
  }),

  unauthorized: http.get('/api/v1/*', () => {
    return HttpResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }),

  badRequest: http.post('/api/v1/*', () => {
    return HttpResponse.json(
      { error: 'Invalid request data' },
      { status: 400 }
    )
  }),
}