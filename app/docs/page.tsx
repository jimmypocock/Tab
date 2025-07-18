import Link from 'next/link'
import { ArrowLeft, Book, Code, FileText, Zap, Play, Globe, Webhook, Shield, Gauge } from 'lucide-react'

const docSections = [
  {
    title: 'API Reference',
    description: 'Complete API documentation with interactive examples',
    href: '/docs/api',
    icon: <Code className="h-6 w-6" />,
    color: 'blue',
    features: [
      'Authentication guide',
      'All endpoints documented',
      'Interactive code examples',
      'Copy-paste curl commands'
    ]
  },
  {
    title: 'Quick Start',
    description: 'Get up and running in under 5 minutes',
    href: '/docs/quickstart',
    icon: <Zap className="h-6 w-6" />,
    color: 'green',
    features: [
      'Account setup',
      'First API call',
      'Basic integration',
      'Testing payments'
    ]
  },
  {
    title: 'Integration Guides',
    description: 'Step-by-step guides for common integrations',
    href: '/docs/guides',
    icon: <Book className="h-6 w-6" />,
    color: 'purple',
    features: [
      'E-commerce platforms',
      'SaaS applications',
      'Mobile apps',
      'Webhook handling'
    ]
  }
]

const codeExample = `// Quick example: Create your first tab
const response = await fetch('https://api.tab.com/v1/tabs', {
  method: 'POST',
  headers: {
    'X-API-Key': 'your_api_key_here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    customer_email: 'customer@example.com',
    customer_name: 'John Doe',
    line_items: [{
      description: 'Professional Services',
      quantity: 1,
      unit_price: 1500.00
    }],
    tax_rate: 0.08
  })
});

const tab = await response.json();
console.log('Payment link:', tab.data.payment_link);`

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="text-gray-600 hover:text-gray-900 transition"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Documentation</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Go to Dashboard →
              </Link>
              <Link
                href="/register"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Everything you need to integrate Tab
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            From quick starts to detailed API references, find all the resources you need to implement Tab's payment collection API.
          </p>
        </div>
      </section>

      {/* Main Documentation Sections */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid md:grid-cols-3 gap-8">
          {docSections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="group bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden"
            >
              <div className="p-8">
                <div className={`inline-flex p-3 rounded-xl mb-4 ${
                  section.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                  section.color === 'green' ? 'bg-green-100 text-green-600' :
                  'bg-purple-100 text-purple-600'
                } group-hover:scale-110 transition-transform`}>
                  {section.icon}
                </div>
                <h2 className="text-2xl font-bold mb-3 group-hover:text-blue-600 transition">
                  {section.title}
                </h2>
                <p className="text-gray-600 mb-6">
                  {section.description}
                </p>
                <ul className="space-y-2">
                  {section.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center text-sm text-gray-600">
                      <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mr-2" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={`h-1 w-full transition-all duration-300 ${
                section.color === 'blue' ? 'bg-blue-600' :
                section.color === 'green' ? 'bg-green-600' :
                'bg-purple-600'
              } group-hover:h-2`} />
            </Link>
          ))}
        </div>
      </section>

      {/* Quick Start Code Example */}
      <section className="py-16 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              Start collecting payments in minutes
            </h2>
            <p className="text-lg text-gray-400">
              Here's a quick example to get you started
            </p>
          </div>
          <div className="max-w-4xl mx-auto">
            <div className="bg-gray-800 rounded-2xl p-8 relative">
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <span className="text-sm text-gray-500">JavaScript</span>
                <button className="p-2 hover:bg-gray-700 rounded-lg transition">
                  <Play className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <pre className="text-sm text-gray-300 overflow-x-auto">
                <code>{codeExample}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Additional Resources */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">Additional Resources</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <Link href="/docs/api#webhooks" className="group text-center">
              <div className="inline-flex p-4 bg-orange-100 text-orange-600 rounded-xl mb-3 group-hover:scale-110 transition">
                <Webhook className="w-6 h-6" />
              </div>
              <h3 className="font-semibold mb-1">Webhooks</h3>
              <p className="text-sm text-gray-600">Real-time payment events</p>
            </Link>
            
            <Link href="/docs/api#authentication" className="group text-center">
              <div className="inline-flex p-4 bg-red-100 text-red-600 rounded-xl mb-3 group-hover:scale-110 transition">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="font-semibold mb-1">Security</h3>
              <p className="text-sm text-gray-600">Best practices & auth</p>
            </Link>
            
            <Link href="/docs/api#rate-limiting" className="group text-center">
              <div className="inline-flex p-4 bg-yellow-100 text-yellow-600 rounded-xl mb-3 group-hover:scale-110 transition">
                <Gauge className="w-6 h-6" />
              </div>
              <h3 className="font-semibold mb-1">Rate Limits</h3>
              <p className="text-sm text-gray-600">API usage guidelines</p>
            </Link>
            
            <Link href="/docs/api#testing" className="group text-center">
              <div className="inline-flex p-4 bg-indigo-100 text-indigo-600 rounded-xl mb-3 group-hover:scale-110 transition">
                <Globe className="w-6 h-6" />
              </div>
              <h3 className="font-semibold mb-1">Testing</h3>
              <p className="text-sm text-gray-600">Test mode & sandbox</p>
            </Link>
          </div>
        </div>
      </section>

      {/* Popular Topics */}
      <section className="py-16 bg-gray-50 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold mb-8">Popular Topics</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl p-6">
              <h3 className="font-semibold mb-4">Getting Started</h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/docs/api#authentication" className="text-blue-600 hover:text-blue-700 flex items-center">
                    <ChevronRight className="w-4 h-4 mr-1" />
                    How to authenticate API requests
                  </Link>
                </li>
                <li>
                  <Link href="/docs/api#tabs" className="text-blue-600 hover:text-blue-700 flex items-center">
                    <ChevronRight className="w-4 h-4 mr-1" />
                    Creating your first tab
                  </Link>
                </li>
                <li>
                  <Link href="/docs/api#testing" className="text-blue-600 hover:text-blue-700 flex items-center">
                    <ChevronRight className="w-4 h-4 mr-1" />
                    Testing with curl commands
                  </Link>
                </li>
                <li>
                  <Link href="/docs/api#webhooks" className="text-blue-600 hover:text-blue-700 flex items-center">
                    <ChevronRight className="w-4 h-4 mr-1" />
                    Setting up webhooks
                  </Link>
                </li>
              </ul>
            </div>
            
            <div className="bg-white rounded-xl p-6">
              <h3 className="font-semibold mb-4">Advanced Topics</h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/docs/api#error-codes" className="text-blue-600 hover:text-blue-700 flex items-center">
                    <ChevronRight className="w-4 h-4 mr-1" />
                    Handling errors gracefully
                  </Link>
                </li>
                <li>
                  <Link href="/docs/api#payments" className="text-blue-600 hover:text-blue-700 flex items-center">
                    <ChevronRight className="w-4 h-4 mr-1" />
                    Payment processing flow
                  </Link>
                </li>
                <li>
                  <Link href="/docs/api#line-items" className="text-blue-600 hover:text-blue-700 flex items-center">
                    <ChevronRight className="w-4 h-4 mr-1" />
                    Managing line items
                  </Link>
                </li>
                <li>
                  <Link href="/docs/api#rate-limiting" className="text-blue-600 hover:text-blue-700 flex items-center">
                    <ChevronRight className="w-4 h-4 mr-1" />
                    Rate limiting best practices
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to start building?</h2>
          <p className="text-lg text-gray-600 mb-8">
            Create your account and start accepting payments today.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/register"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Get Started Free
            </Link>
            <Link
              href="/docs/api"
              className="bg-gray-100 text-gray-700 px-8 py-3 rounded-lg hover:bg-gray-200 transition font-medium"
            >
              Explore API Docs
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}