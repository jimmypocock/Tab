'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Copy, Check, ChevronRight, Search, Code, FileText, Zap, CreditCard, Webhook, Globe } from 'lucide-react'

// API Documentation Data
const apiEndpoints = {
  authentication: {
    title: 'Authentication',
    icon: <Zap className="w-5 h-5" />,
    description: 'Learn how to authenticate your API requests',
    content: {
      overview: 'All API requests require authentication using an API key. Include your API key in the X-API-Key header of every request.',
      example: {
        curl: `curl -X GET https://api.tab.com/v1/tabs \\
  -H "X-API-Key: tab_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"`,
        javascript: `const response = await fetch('https://api.tab.com/v1/tabs', {
  headers: {
    'X-API-Key': 'tab_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  }
});`,
        python: `import requests

response = requests.get(
    'https://api.tab.com/v1/tabs',
    headers={'X-API-Key': 'tab_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
)`
      },
      testKeys: [
        'tab_test_12345678901234567890123456789012',
        'tab_test_98765432109876543210987654321098'
      ]
    }
  },
  tabs: {
    title: 'Tabs',
    icon: <FileText className="w-5 h-5" />,
    description: 'Create and manage payment tabs',
    endpoints: [
      {
        method: 'POST',
        path: '/tabs',
        title: 'Create a Tab',
        description: 'Create a new payment tab with line items',
        request: {
          curl: `curl -X POST http://localhost:1235/api/v1/tabs \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: tab_test_12345678901234567890123456789012" \\
  -d '{
    "customer_email": "customer@example.com",
    "customer_name": "John Doe",
    "line_items": [
      {
        "description": "Consulting Service",
        "quantity": 2,
        "unit_price": 150.00
      },
      {
        "description": "Setup Fee",
        "quantity": 1,
        "unit_price": 50.00
      }
    ],
    "tax_rate": 0.08,
    "metadata": {
      "order_id": "12345"
    }
  }'`,
          javascript: `const response = await fetch('http://localhost:1235/api/v1/tabs', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'tab_test_12345678901234567890123456789012'
  },
  body: JSON.stringify({
    customer_email: 'customer@example.com',
    customer_name: 'John Doe',
    line_items: [
      {
        description: 'Consulting Service',
        quantity: 2,
        unit_price: 150.00
      }
    ],
    tax_rate: 0.08
  })
});

const tab = await response.json();`,
          python: `import requests

response = requests.post(
    'http://localhost:1235/api/v1/tabs',
    headers={
        'Content-Type': 'application/json',
        'X-API-Key': 'tab_test_12345678901234567890123456789012'
    },
    json={
        'customer_email': 'customer@example.com',
        'customer_name': 'John Doe',
        'line_items': [
            {
                'description': 'Consulting Service',
                'quantity': 2,
                'unit_price': 150.00
            }
        ],
        'tax_rate': 0.08
    }
)`
        },
        response: `{
  "data": {
    "id": "tab_1234567890",
    "merchant_id": "550e8400-e29b-41d4-a716-446655440001",
    "customer_email": "customer@example.com",
    "customer_name": "John Doe",
    "status": "open",
    "currency": "USD",
    "subtotal": "350.00",
    "tax_amount": "28.00",
    "total_amount": "378.00",
    "paid_amount": "0.00",
    "payment_link": "http://localhost:1235/pay/tab_1234567890",
    "created_at": "2024-01-16T12:00:00Z",
    "updated_at": "2024-01-16T12:00:00Z",
    "line_items": [
      {
        "id": "li_1234567890",
        "description": "Consulting Service",
        "quantity": 2,
        "unit_price": "150.00",
        "total": "300.00"
      },
      {
        "id": "li_0987654321",
        "description": "Setup Fee",
        "quantity": 1,
        "unit_price": "50.00",
        "total": "50.00"
      }
    ]
  }
}`
      },
      {
        method: 'GET',
        path: '/tabs',
        title: 'List Tabs',
        description: 'Retrieve a paginated list of tabs with optional filtering',
        request: {
          curl: `# Get all open tabs
curl -X GET "http://localhost:1235/api/v1/tabs?status=open&limit=10" \\
  -H "X-API-Key: tab_test_12345678901234567890123456789012"

# Get tabs created in the last 7 days
curl -X GET "http://localhost:1235/api/v1/tabs?created_after=2024-01-09T00:00:00Z" \\
  -H "X-API-Key: tab_test_12345678901234567890123456789012"

# Get specific fields only
curl -X GET "http://localhost:1235/api/v1/tabs?fields=id,customer_email,total_amount,status" \\
  -H "X-API-Key: tab_test_12345678901234567890123456789012"`,
          javascript: `// Get all open tabs
const response = await fetch('http://localhost:1235/api/v1/tabs?status=open&limit=10', {
  headers: {
    'X-API-Key': 'tab_test_12345678901234567890123456789012'
  }
});

const tabs = await response.json();`,
          python: `# Get all open tabs
response = requests.get(
    'http://localhost:1235/api/v1/tabs',
    params={'status': 'open', 'limit': 10},
    headers={'X-API-Key': 'tab_test_12345678901234567890123456789012'}
)`
        },
        queryParams: [
          { name: 'status', type: 'string', description: 'Filter by status: open, partial, paid, void' },
          { name: 'customer_email', type: 'string', description: 'Filter by customer email' },
          { name: 'created_after', type: 'string', description: 'Filter by creation date (ISO 8601)' },
          { name: 'created_before', type: 'string', description: 'Filter by creation date (ISO 8601)' },
          { name: 'limit', type: 'integer', description: 'Number of results (default: 50, max: 100)' },
          { name: 'offset', type: 'integer', description: 'Number of results to skip' },
          { name: 'fields', type: 'string', description: 'Comma-separated list of fields to include' }
        ]
      },
      {
        method: 'GET',
        path: '/tabs/{id}',
        title: 'Get a Tab',
        description: 'Retrieve details of a specific tab',
        request: {
          curl: `curl -X GET http://localhost:1235/api/v1/tabs/tab_1234567890 \\
  -H "X-API-Key: tab_test_12345678901234567890123456789012"`,
          javascript: `const response = await fetch('http://localhost:1235/api/v1/tabs/tab_1234567890', {
  headers: {
    'X-API-Key': 'tab_test_12345678901234567890123456789012'
  }
});

const tab = await response.json();`,
          python: `response = requests.get(
    'http://localhost:1235/api/v1/tabs/tab_1234567890',
    headers={'X-API-Key': 'tab_test_12345678901234567890123456789012'}
)`
        }
      },
      {
        method: 'PATCH',
        path: '/tabs/{id}',
        title: 'Update a Tab',
        description: 'Update tab details (only for open tabs)',
        request: {
          curl: `curl -X PATCH http://localhost:1235/api/v1/tabs/tab_1234567890 \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: tab_test_12345678901234567890123456789012" \\
  -d '{
    "customer_name": "John Smith",
    "external_reference": "ORDER-456",
    "metadata": {
      "notes": "VIP customer",
      "discount_code": "SAVE10"
    }
  }'`,
          javascript: `const response = await fetch('http://localhost:1235/api/v1/tabs/tab_1234567890', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'tab_test_12345678901234567890123456789012'
  },
  body: JSON.stringify({
    customer_name: 'John Smith',
    metadata: {
      notes: 'VIP customer'
    }
  })
});`,
          python: `response = requests.patch(
    'http://localhost:1235/api/v1/tabs/tab_1234567890',
    headers={
        'Content-Type': 'application/json',
        'X-API-Key': 'tab_test_12345678901234567890123456789012'
    },
    json={
        'customer_name': 'John Smith',
        'metadata': {
            'notes': 'VIP customer'
        }
    }
)`
        }
      },
      {
        method: 'POST',
        path: '/tabs/{id}/void',
        title: 'Void a Tab',
        description: 'Cancel an open tab',
        request: {
          curl: `curl -X POST http://localhost:1235/api/v1/tabs/tab_1234567890/void \\
  -H "X-API-Key: tab_test_12345678901234567890123456789012"`,
          javascript: `const response = await fetch('http://localhost:1235/api/v1/tabs/tab_1234567890/void', {
  method: 'POST',
  headers: {
    'X-API-Key': 'tab_test_12345678901234567890123456789012'
  }
});`,
          python: `response = requests.post(
    'http://localhost:1235/api/v1/tabs/tab_1234567890/void',
    headers={'X-API-Key': 'tab_test_12345678901234567890123456789012'}
)`
        }
      }
    ]
  },
  lineItems: {
    title: 'Line Items',
    icon: <Code className="w-5 h-5" />,
    description: 'Add items to existing tabs',
    endpoints: [
      {
        method: 'POST',
        path: '/line-items',
        title: 'Add Line Items',
        description: 'Add line items to an existing open tab',
        request: {
          curl: `curl -X POST http://localhost:1235/api/v1/line-items \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: tab_test_12345678901234567890123456789012" \\
  -d '{
    "tab_id": "tab_1234567890",
    "items": [
      {
        "description": "Rush Delivery Fee",
        "quantity": 1,
        "unit_price": 25.00
      },
      {
        "description": "Extended Warranty",
        "quantity": 1,
        "unit_price": 99.99,
        "metadata": {
          "warranty_years": 3
        }
      }
    ]
  }'`,
          javascript: `const response = await fetch('http://localhost:1235/api/v1/line-items', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'tab_test_12345678901234567890123456789012'
  },
  body: JSON.stringify({
    tab_id: 'tab_1234567890',
    items: [
      {
        description: 'Rush Delivery Fee',
        quantity: 1,
        unit_price: 25.00
      }
    ]
  })
});`,
          python: `response = requests.post(
    'http://localhost:1235/api/v1/line-items',
    headers={
        'Content-Type': 'application/json',
        'X-API-Key': 'tab_test_12345678901234567890123456789012'
    },
    json={
        'tab_id': 'tab_1234567890',
        'items': [
            {
                'description': 'Rush Delivery Fee',
                'quantity': 1,
                'unit_price': 25.00
            }
        ]
    }
)`
        },
        response: `{
  "data": {
    "tab_id": "tab_1234567890",
    "items_added": 2,
    "new_subtotal": "474.99",
    "new_tax_amount": "38.00",
    "new_total_amount": "512.99",
    "line_items": [
      {
        "id": "li_2345678901",
        "description": "Rush Delivery Fee",
        "quantity": 1,
        "unit_price": "25.00",
        "total": "25.00"
      },
      {
        "id": "li_3456789012",
        "description": "Extended Warranty",
        "quantity": 1,
        "unit_price": "99.99",
        "total": "99.99"
      }
    ]
  }
}`
      }
    ]
  },
  payments: {
    title: 'Payments',
    icon: <CreditCard className="w-5 h-5" />,
    description: 'Process and track payments',
    endpoints: [
      {
        method: 'GET',
        path: '/payments',
        title: 'List Payments',
        description: 'Get all payments for your account',
        request: {
          curl: `# Get all payments
curl -X GET http://localhost:1235/api/v1/payments \\
  -H "X-API-Key: tab_test_12345678901234567890123456789012"

# Get payments for a specific tab
curl -X GET "http://localhost:1235/api/v1/payments?tab_id=tab_1234567890" \\
  -H "X-API-Key: tab_test_12345678901234567890123456789012"

# Get only successful payments
curl -X GET "http://localhost:1235/api/v1/payments?status=succeeded" \\
  -H "X-API-Key: tab_test_12345678901234567890123456789012"`,
          javascript: `// Get payments for a specific tab
const response = await fetch('http://localhost:1235/api/v1/payments?tab_id=tab_1234567890', {
  headers: {
    'X-API-Key': 'tab_test_12345678901234567890123456789012'
  }
});

const payments = await response.json();`,
          python: `# Get payments for a specific tab
response = requests.get(
    'http://localhost:1235/api/v1/payments',
    params={'tab_id': 'tab_1234567890'},
    headers={'X-API-Key': 'tab_test_12345678901234567890123456789012'}
)`
        }
      }
    ]
  },
  publicEndpoints: {
    title: 'Public Endpoints',
    icon: <Globe className="w-5 h-5" />,
    description: 'Endpoints that don\'t require authentication',
    endpoints: [
      {
        method: 'GET',
        path: '/public/tabs/{id}',
        title: 'Get Public Tab',
        description: 'Get tab details for payment page (no auth required)',
        request: {
          curl: `curl -X GET http://localhost:1235/api/v1/public/tabs/tab_1234567890`,
          javascript: `const response = await fetch('http://localhost:1235/api/v1/public/tabs/tab_1234567890');
const tab = await response.json();`,
          python: `response = requests.get('http://localhost:1235/api/v1/public/tabs/tab_1234567890')`
        }
      },
      {
        method: 'POST',
        path: '/public/payment-intent',
        title: 'Create Payment Intent',
        description: 'Create a Stripe payment intent for tab payment',
        request: {
          curl: `curl -X POST http://localhost:1235/api/v1/public/payment-intent \\
  -H "Content-Type: application/json" \\
  -d '{
    "tab_id": "tab_1234567890",
    "amount": 378.00
  }'`,
          javascript: `const response = await fetch('http://localhost:1235/api/v1/public/payment-intent', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    tab_id: 'tab_1234567890',
    amount: 378.00
  })
});`,
          python: `response = requests.post(
    'http://localhost:1235/api/v1/public/payment-intent',
    json={
        'tab_id': 'tab_1234567890',
        'amount': 378.00
    }
)`
        }
      }
    ]
  },
  webhooks: {
    title: 'Webhooks',
    icon: <Webhook className="w-5 h-5" />,
    description: 'Handle Stripe webhook events',
    endpoints: [
      {
        method: 'POST',
        path: '/webhooks/stripe',
        title: 'Stripe Webhook',
        description: 'Endpoint for Stripe to send payment events',
        setup: `# For local development, use Stripe CLI:
stripe listen --forward-to localhost:1235/api/v1/webhooks/stripe

# Copy the webhook signing secret and add to your .env:
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# Trigger test events:
stripe trigger payment_intent.succeeded`,
        headers: [
          { name: 'stripe-signature', required: true, description: 'Stripe webhook signature for verification' }
        ]
      }
    ]
  }
}

// Code Language Tabs
const languages = ['curl', 'javascript', 'python'] as const
type Language = typeof languages[number]

export default function APIDocsPage() {
  const [activeSection, setActiveSection] = useState('authentication')
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('curl')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const copyToClipboard = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code)
    setCopiedCode(id)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const renderEndpoint = (endpoint: any, sectionKey: string) => {
    const codeId = `${sectionKey}-${endpoint.method}-${endpoint.path}`
    const code = endpoint.request?.[selectedLanguage] || endpoint.request?.curl || ''

    return (
      <div key={endpoint.path} className="border-l-2 border-gray-200 pl-6 pb-8">
        <div className="flex items-center gap-3 mb-3">
          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
            endpoint.method === 'GET' ? 'bg-blue-100 text-blue-700' :
            endpoint.method === 'POST' ? 'bg-green-100 text-green-700' :
            endpoint.method === 'PATCH' ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {endpoint.method}
          </span>
          <code className="text-sm font-mono text-gray-700">{endpoint.path}</code>
        </div>
        
        <h4 className="text-lg font-semibold mb-2">{endpoint.title}</h4>
        <p className="text-gray-600 mb-4">{endpoint.description}</p>

        {endpoint.queryParams && (
          <div className="mb-6">
            <h5 className="font-medium mb-3">Query Parameters</h5>
            <div className="bg-gray-50 rounded-lg p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-200">
                    <th className="pb-2 font-medium">Parameter</th>
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoint.queryParams.map((param: any) => (
                    <tr key={param.name} className="border-b border-gray-100">
                      <td className="py-2 font-mono text-xs">{param.name}</td>
                      <td className="py-2 text-gray-600">{param.type}</td>
                      <td className="py-2 text-gray-600">{param.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {endpoint.headers && (
          <div className="mb-6">
            <h5 className="font-medium mb-3">Headers</h5>
            <div className="bg-gray-50 rounded-lg p-4">
              {endpoint.headers.map((header: any) => (
                <div key={header.name} className="flex items-start gap-2 mb-2">
                  <code className="text-sm font-mono">{header.name}:</code>
                  <span className="text-sm text-gray-600">{header.description}</span>
                  {header.required && <span className="text-xs text-red-600 font-medium">Required</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {endpoint.setup && (
          <div className="mb-6">
            <h5 className="font-medium mb-3">Setup Instructions</h5>
            <div className="bg-gray-900 rounded-lg p-4 relative">
              <pre className="text-sm text-gray-300 overflow-x-auto">
                <code>{endpoint.setup}</code>
              </pre>
              <button
                onClick={() => copyToClipboard(endpoint.setup, `${codeId}-setup`)}
                className="absolute top-4 right-4 p-2 rounded hover:bg-gray-800 transition"
              >
                {copiedCode === `${codeId}-setup` ? 
                  <Check className="w-4 h-4 text-green-400" /> : 
                  <Copy className="w-4 h-4 text-gray-400" />
                }
              </button>
            </div>
          </div>
        )}

        {endpoint.request && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h5 className="font-medium">Request</h5>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                {languages.map(lang => (
                  <button
                    key={lang}
                    onClick={() => setSelectedLanguage(lang)}
                    className={`px-3 py-1 text-sm rounded transition ${
                      selectedLanguage === lang 
                        ? 'bg-white text-gray-900 shadow-sm' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {lang === 'curl' ? 'cURL' : lang === 'javascript' ? 'JavaScript' : 'Python'}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 relative">
              <pre className="text-sm text-gray-300 overflow-x-auto">
                <code>{code}</code>
              </pre>
              <button
                onClick={() => copyToClipboard(code, codeId)}
                className="absolute top-4 right-4 p-2 rounded hover:bg-gray-800 transition"
              >
                {copiedCode === codeId ? 
                  <Check className="w-4 h-4 text-green-400" /> : 
                  <Copy className="w-4 h-4 text-gray-400" />
                }
              </button>
            </div>
          </div>
        )}

        {endpoint.response && (
          <div>
            <h5 className="font-medium mb-3">Response</h5>
            <div className="bg-gray-50 rounded-lg p-4 relative">
              <pre className="text-sm text-gray-700 overflow-x-auto">
                <code>{endpoint.response}</code>
              </pre>
              <button
                onClick={() => copyToClipboard(endpoint.response, `${codeId}-response`)}
                className="absolute top-4 right-4 p-2 rounded hover:bg-gray-200 transition"
              >
                {copiedCode === `${codeId}-response` ? 
                  <Check className="w-4 h-4 text-green-600" /> : 
                  <Copy className="w-4 h-4 text-gray-400" />
                }
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <Link
                href="/docs"
                className="text-gray-600 hover:text-gray-900 transition"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">API Reference</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search endpoints..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <Link
                href="/dashboard"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Dashboard →
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="lg:grid lg:grid-cols-4 lg:gap-8">
          {/* Sidebar Navigation */}
          <nav className="lg:col-span-1">
            <div className="sticky top-24 space-y-1">
              {Object.entries(apiEndpoints).map(([key, section]) => (
                <button
                  key={key}
                  onClick={() => setActiveSection(key)}
                  className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition ${
                    activeSection === key 
                      ? 'bg-blue-50 text-blue-700' 
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {section.icon}
                  <span className="font-medium">{section.title}</span>
                  <ChevronRight className={`w-4 h-4 ml-auto transition ${
                    activeSection === key ? 'rotate-90' : ''
                  }`} />
                </button>
              ))}
              
              <div className="pt-6 border-t border-gray-200 mt-6">
                <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Quick Links
                </h3>
                <div className="space-y-1">
                  <a href="#error-codes" className="block px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                    Error Codes
                  </a>
                  <a href="#rate-limiting" className="block px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                    Rate Limiting
                  </a>
                  <a href="#testing" className="block px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
                    Testing Guide
                  </a>
                </div>
              </div>

              <div className="pt-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Test API Keys</h4>
                  <p className="text-sm text-blue-700 mb-3">Use these keys for local development:</p>
                  <div className="space-y-2">
                    {apiEndpoints.authentication.content.testKeys.map((key) => (
                      <div key={key} className="flex items-center gap-2">
                        <code className="text-xs bg-white px-2 py-1 rounded flex-1 truncate">
                          {key}
                        </code>
                        <button
                          onClick={() => copyToClipboard(key, key)}
                          className="p-1 hover:bg-blue-100 rounded"
                        >
                          {copiedCode === key ? 
                            <Check className="w-3 h-3 text-green-600" /> : 
                            <Copy className="w-3 h-3 text-blue-600" />
                          }
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </nav>

          {/* Main Content */}
          <main className="lg:col-span-3 mt-8 lg:mt-0">
            <div className="bg-white rounded-lg shadow-sm p-8">
              {activeSection === 'authentication' && (
                <div>
                  <h2 className="text-3xl font-bold mb-2">{apiEndpoints.authentication.title}</h2>
                  <p className="text-lg text-gray-600 mb-8">{apiEndpoints.authentication.description}</p>
                  
                  <div className="prose prose-gray max-w-none">
                    <p className="mb-6">{apiEndpoints.authentication.content.overview}</p>
                    
                    <div className="mb-8">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xl font-semibold">Example Request</h3>
                        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                          {languages.map(lang => (
                            <button
                              key={lang}
                              onClick={() => setSelectedLanguage(lang)}
                              className={`px-3 py-1 text-sm rounded transition ${
                                selectedLanguage === lang 
                                  ? 'bg-white text-gray-900 shadow-sm' 
                                  : 'text-gray-600 hover:text-gray-900'
                              }`}
                            >
                              {lang === 'curl' ? 'cURL' : lang === 'javascript' ? 'JavaScript' : 'Python'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="bg-gray-900 rounded-lg p-4 relative">
                        <pre className="text-sm text-gray-300 overflow-x-auto">
                          <code>{apiEndpoints.authentication.content.example[selectedLanguage]}</code>
                        </pre>
                        <button
                          onClick={() => copyToClipboard(apiEndpoints.authentication.content.example[selectedLanguage], 'auth-example')}
                          className="absolute top-4 right-4 p-2 rounded hover:bg-gray-800 transition"
                        >
                          {copiedCode === 'auth-example' ? 
                            <Check className="w-4 h-4 text-green-400" /> : 
                            <Copy className="w-4 h-4 text-gray-400" />
                          }
                        </button>
                      </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <h4 className="font-medium text-amber-900 mb-2">Important Security Note</h4>
                      <p className="text-sm text-amber-700">
                        Never expose your API keys in client-side code. Always make API requests from your backend server.
                        The test keys provided are safe to use in local development only.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {Object.entries(apiEndpoints).map(([key, section]) => {
                if (key === 'authentication' || activeSection !== key) return null
                
                return (
                  <div key={key}>
                    <h2 className="text-3xl font-bold mb-2">{section.title}</h2>
                    <p className="text-lg text-gray-600 mb-8">{section.description}</p>
                    
                    {'endpoints' in section && section.endpoints?.map((endpoint) => 
                      renderEndpoint(endpoint, key)
                    )}
                  </div>
                )
              })}

              {/* Additional Sections */}
              {activeSection === 'tabs' && (
                <div id="error-codes" className="mt-16 pt-8 border-t border-gray-200">
                  <h2 className="text-2xl font-bold mb-6">Error Codes</h2>
                  <div className="bg-gray-50 rounded-lg p-6">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left border-b border-gray-200">
                          <th className="pb-3 font-medium">Code</th>
                          <th className="pb-3 font-medium">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { code: 'UNAUTHORIZED', desc: 'Missing or invalid API key' },
                          { code: 'FORBIDDEN', desc: 'Access denied to resource' },
                          { code: 'NOT_FOUND', desc: 'Resource not found' },
                          { code: 'VALIDATION_ERROR', desc: 'Invalid request parameters' },
                          { code: 'INVALID_TAB_STATUS', desc: 'Operation not allowed for tab status' },
                          { code: 'PAYMENT_FAILED', desc: 'Payment processing failed' },
                          { code: 'RATE_LIMIT_EXCEEDED', desc: 'Too many requests' }
                        ].map(({ code, desc }) => (
                          <tr key={code} className="border-b border-gray-100">
                            <td className="py-3 font-mono text-sm">{code}</td>
                            <td className="py-3 text-gray-600">{desc}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div id="rate-limiting" className="mt-12">
                    <h2 className="text-2xl font-bold mb-6">Rate Limiting</h2>
                    <div className="prose prose-gray max-w-none">
                      <p className="mb-4">API requests are rate limited to ensure fair usage:</p>
                      <ul className="list-disc ml-6 mb-4">
                        <li>Test mode: 100 requests per minute</li>
                        <li>Live mode: 1000 requests per minute</li>
                      </ul>
                      <p>Rate limit information is included in response headers:</p>
                      <div className="bg-gray-900 rounded-lg p-4 mt-4">
                        <pre className="text-sm text-gray-300">
                          <code>{`X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1673884800`}</code>
                        </pre>
                      </div>
                    </div>
                  </div>

                  <div id="testing" className="mt-12">
                    <h2 className="text-2xl font-bold mb-6">Quick Testing Guide</h2>
                    <div className="space-y-6">
                      <div className="bg-blue-50 rounded-lg p-6">
                        <h3 className="font-semibold text-blue-900 mb-3">1. Create a Tab</h3>
                        <div className="bg-gray-900 rounded-lg p-4 relative mb-4">
                          <pre className="text-sm text-gray-300 overflow-x-auto">
                            <code>{`TAB_ID=$(curl -s -X POST http://localhost:1235/api/v1/tabs \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: tab_test_12345678901234567890123456789012" \\
  -d '{
    "customer_email": "test@example.com",
    "customer_name": "Test User",
    "line_items": [
      {"description": "Test Item", "quantity": 1, "unit_price": 100.00}
    ],
    "tax_rate": 0.08
  }' | jq -r '.data.id')

echo "Created tab: $TAB_ID"`}</code>
                          </pre>
                          <button
                            onClick={() => copyToClipboard(`TAB_ID=$(curl -s -X POST http://localhost:1235/api/v1/tabs \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: tab_test_12345678901234567890123456789012" \\
  -d '{
    "customer_email": "test@example.com",
    "customer_name": "Test User",
    "line_items": [
      {"description": "Test Item", "quantity": 1, "unit_price": 100.00}
    ],
    "tax_rate": 0.08
  }' | jq -r '.data.id')

echo "Created tab: $TAB_ID"`, 'test-create')}
                            className="absolute top-4 right-4 p-2 rounded hover:bg-gray-800 transition"
                          >
                            {copiedCode === 'test-create' ? 
                              <Check className="w-4 h-4 text-green-400" /> : 
                              <Copy className="w-4 h-4 text-gray-400" />
                            }
                          </button>
                        </div>
                      </div>

                      <div className="bg-green-50 rounded-lg p-6">
                        <h3 className="font-semibold text-green-900 mb-3">2. Get the Payment Link</h3>
                        <div className="bg-gray-900 rounded-lg p-4 relative">
                          <pre className="text-sm text-gray-300 overflow-x-auto">
                            <code>{`curl -s -X GET http://localhost:1235/api/v1/tabs/$TAB_ID \\
  -H "X-API-Key: tab_test_12345678901234567890123456789012" \\
  | jq '.data.payment_link'`}</code>
                          </pre>
                          <button
                            onClick={() => copyToClipboard(`curl -s -X GET http://localhost:1235/api/v1/tabs/$TAB_ID \\
  -H "X-API-Key: tab_test_12345678901234567890123456789012" \\
  | jq '.data.payment_link'`, 'test-link')}
                            className="absolute top-4 right-4 p-2 rounded hover:bg-gray-800 transition"
                          >
                            {copiedCode === 'test-link' ? 
                              <Check className="w-4 h-4 text-green-400" /> : 
                              <Copy className="w-4 h-4 text-gray-400" />
                            }
                          </button>
                        </div>
                      </div>

                      <div className="bg-purple-50 rounded-lg p-6">
                        <h3 className="font-semibold text-purple-900 mb-3">3. Check Tab Status</h3>
                        <div className="bg-gray-900 rounded-lg p-4 relative">
                          <pre className="text-sm text-gray-300 overflow-x-auto">
                            <code>{`curl -X GET http://localhost:1235/api/v1/tabs/$TAB_ID \\
  -H "X-API-Key: tab_test_12345678901234567890123456789012" \\
  | jq '.data | {id, status, total_amount, paid_amount}'`}</code>
                          </pre>
                          <button
                            onClick={() => copyToClipboard(`curl -X GET http://localhost:1235/api/v1/tabs/$TAB_ID \\
  -H "X-API-Key: tab_test_12345678901234567890123456789012" \\
  | jq '.data | {id, status, total_amount, paid_amount}'`, 'test-status')}
                            className="absolute top-4 right-4 p-2 rounded hover:bg-gray-800 transition"
                          >
                            {copiedCode === 'test-status' ? 
                              <Check className="w-4 h-4 text-green-400" /> : 
                              <Copy className="w-4 h-4 text-gray-400" />
                            }
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}