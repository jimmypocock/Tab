'use client'

import { useState, useEffect } from 'react'
import { Button, Input, Badge, Card, Modal, Spinner } from '@/components/ui'
import { 
  ProcessorType, 
  stripeCredentialsSchema,
  squareCredentialsSchema,
  paypalCredentialsSchema,
  authorizeNetCredentialsSchema,
} from '@/lib/payment-processors/types'
import { MerchantProcessor } from '@/lib/db/schema'
import { 
  CreditCard, 
  Square, 
  DollarSign, 
  Shield, 
  CheckCircle,
  XCircle,
  Copy,
  TestTube,
  Zap
} from 'lucide-react'
import { API_ROUTES, getWebhookUrl } from '@/lib/config/routes'

interface ProcessorSettingsProps {
  userId: string
}

interface ProcessorForm {
  [ProcessorType.STRIPE]: {
    secretKey: string
    publishableKey: string
  }
  [ProcessorType.SQUARE]: {
    accessToken: string
    applicationId: string
    locationId: string
  }
  [ProcessorType.PAYPAL]: {
    clientId: string
    clientSecret: string
  }
  [ProcessorType.AUTHORIZE_NET]: {
    loginId: string
    transactionKey: string
  }
}

const processorConfig = {
  [ProcessorType.STRIPE]: {
    label: 'Stripe',
    description: 'Accept credit cards, digital wallets, and 135+ currencies',
    icon: CreditCard,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    available: true,
  },
  [ProcessorType.SQUARE]: {
    label: 'Square',
    description: 'Integrated payments for online and in-person sales',
    icon: Square,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    available: false,
  },
  [ProcessorType.PAYPAL]: {
    label: 'PayPal',
    description: 'Accept PayPal and Venmo payments',
    icon: DollarSign,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    available: false,
  },
  [ProcessorType.AUTHORIZE_NET]: {
    label: 'Authorize.Net',
    description: 'Traditional payment gateway for credit cards',
    icon: Shield,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    available: false,
  },
}

export default function ProcessorSettings({ userId: _userId }: ProcessorSettingsProps) {
  const [processors, setProcessors] = useState<MerchantProcessor[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedProcessor, setSelectedProcessor] = useState<ProcessorType | null>(null)
  const [testMode, setTestMode] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [copiedWebhook, setCopiedWebhook] = useState<string | null>(null)
  const [testingProcessor, setTestingProcessor] = useState<string | null>(null)

  // Form state for each processor type
  const [formData, setFormData] = useState<ProcessorForm>({
    [ProcessorType.STRIPE]: { secretKey: '', publishableKey: '' },
    [ProcessorType.SQUARE]: { accessToken: '', applicationId: '', locationId: '' },
    [ProcessorType.PAYPAL]: { clientId: '', clientSecret: '' },
    [ProcessorType.AUTHORIZE_NET]: { loginId: '', transactionKey: '' },
  })

  useEffect(() => {
    fetchProcessors()
  }, [])

  const fetchProcessors = async () => {
    try {
      const response = await fetch(API_ROUTES.merchant.processors.list)
      if (!response.ok) throw new Error('Failed to fetch processors')
      
      const data = await response.json()
      setProcessors(data.data || [])
    } catch (err) {
      setError('Failed to load payment processors')
    } finally {
      setLoading(false)
    }
  }

  const handleAddProcessor = async () => {
    if (!selectedProcessor) return
    
    setSaving(true)
    setError(null)
    
    try {
      const credentials = formData[selectedProcessor]
      
      // Validate credentials based on processor type
      let validatedCredentials
      switch (selectedProcessor) {
        case ProcessorType.STRIPE:
          validatedCredentials = stripeCredentialsSchema.parse(credentials)
          break
        case ProcessorType.SQUARE:
          validatedCredentials = squareCredentialsSchema.parse(credentials)
          break
        case ProcessorType.PAYPAL:
          validatedCredentials = paypalCredentialsSchema.parse(credentials)
          break
        case ProcessorType.AUTHORIZE_NET:
          validatedCredentials = authorizeNetCredentialsSchema.parse(credentials)
          break
      }

      const response = await fetch(API_ROUTES.merchant.processors.list, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          processorType: selectedProcessor,
          credentials: validatedCredentials,
          isTestMode: testMode,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error?.message || 'Failed to add processor')
      }

      setSuccess('Payment processor added successfully!')
      setShowAddModal(false)
      resetForm()
      fetchProcessors()
    } catch (err: any) {
      setError(err.message || 'Failed to add processor')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleProcessor = async (processorId: string, isActive: boolean) => {
    try {
      const response = await fetch(API_ROUTES.merchant.processors.detail(processorId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })

      if (!response.ok) throw new Error('Failed to update processor')
      
      setSuccess(isActive ? 'Processor activated' : 'Processor deactivated')
      fetchProcessors()
    } catch (err) {
      setError('Failed to update processor status')
    }
  }

  const handleDeleteProcessor = async (processorId: string) => {
    if (!confirm('Are you sure you want to remove this payment processor?')) return
    
    try {
      const response = await fetch(API_ROUTES.merchant.processors.detail(processorId), {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete processor')
      
      setSuccess('Payment processor removed')
      fetchProcessors()
    } catch (err) {
      setError('Failed to remove processor')
    }
  }

  const handleTestPayment = async (processor: MerchantProcessor) => {
    setTestingProcessor(processor.id)
    setError(null)
    setSuccess(null)
    
    try {
      // Create a test tab
      const tabResponse = await fetch(API_ROUTES.tabs.list, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail: 'test@example.com',
          customerName: 'Test Customer',
          description: `Test payment for ${processorConfig[processor.processorType as ProcessorType].label}`,
          lineItems: [{
            description: 'Test Item',
            quantity: 1,
            unitPrice: 1.00
          }],
          testMode: processor.isTestMode
        })
      })
      
      if (!tabResponse.ok) {
        throw new Error('Failed to create test tab')
      }
      
      const { data: tab } = await tabResponse.json()
      
      // Create a payment intent
      const paymentResponse = await fetch(API_ROUTES.payments.list, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tabId: tab.id,
          amount: 1.00,
          processorType: processor.processorType
        })
      })
      
      if (!paymentResponse.ok) {
        throw new Error('Failed to create test payment')
      }
      
      setSuccess(`Test payment created successfully! Check your ${processorConfig[processor.processorType as ProcessorType].label} dashboard.`)
    } catch (err: any) {
      setError(err.message || 'Failed to create test payment')
    } finally {
      setTestingProcessor(null)
    }
  }

  const resetForm = () => {
    setSelectedProcessor(null)
    setFormData({
      [ProcessorType.STRIPE]: { secretKey: '', publishableKey: '' },
      [ProcessorType.SQUARE]: { accessToken: '', applicationId: '', locationId: '' },
      [ProcessorType.PAYPAL]: { clientId: '', clientSecret: '' },
      [ProcessorType.AUTHORIZE_NET]: { loginId: '', transactionKey: '' },
    })
    setError(null)
    setSuccess(null)
  }

  const copyWebhookUrl = async (processorType: string) => {
    try {
      const url = getWebhookUrl(processorType)
      await navigator.clipboard.writeText(url)
      setCopiedWebhook(processorType)
      setTimeout(() => setCopiedWebhook(null), 2000)
    } catch (err) {
      console.error('Failed to copy webhook URL:', err)
    }
  }

  const renderProcessorForm = () => {
    if (!selectedProcessor) return null

    switch (selectedProcessor) {
      case ProcessorType.STRIPE:
        return (
          <>
            <Input
              label="Secret Key"
              type="password"
              placeholder={testMode ? "sk_test_..." : "sk_live_..."}
              value={formData[ProcessorType.STRIPE].secretKey}
              onChange={(e) => setFormData({
                ...formData,
                [ProcessorType.STRIPE]: {
                  ...formData[ProcessorType.STRIPE],
                  secretKey: e.target.value
                }
              })}
              required
            />
            <Input
              label="Publishable Key"
              placeholder={testMode ? "pk_test_..." : "pk_live_..."}
              value={formData[ProcessorType.STRIPE].publishableKey}
              onChange={(e) => setFormData({
                ...formData,
                [ProcessorType.STRIPE]: {
                  ...formData[ProcessorType.STRIPE],
                  publishableKey: e.target.value
                }
              })}
              required
            />
            <div className="space-y-3 mt-4">
              <div className="text-sm text-gray-500">
                Find your API keys in your{' '}
                <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Stripe Dashboard
                </a>
              </div>
              
              {testMode && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                  <strong className="text-yellow-800">Test Mode:</strong> Use test API keys (starting with sk_test_ and pk_test_)
                </div>
              )}
              
              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                <strong className="text-blue-800">Webhook Configuration:</strong>
                <p className="mt-1 text-blue-700">After adding this processor, configure webhooks in Stripe with this URL:</p>
                <code className="block mt-2 p-2 bg-white rounded text-xs">
                  {getWebhookUrl(ProcessorType.STRIPE)}
                </code>
              </div>
            </div>
          </>
        )
      
      // Add other processor forms here as they're implemented
      default:
        return (
          <div className="text-center py-8 text-gray-500">
            {processorConfig[selectedProcessor].label} integration coming soon!
          </div>
        )
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner data-testid="spinner" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {/* Configured Processors */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Configured Processors</h3>
        
        {processors.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-gray-100 rounded-full">
                <CreditCard className="w-12 h-12 text-gray-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">No payment processors configured</h3>
                <p className="text-gray-500 mt-1">Add a payment processor to start accepting payments from your customers.</p>
              </div>
              <Button onClick={() => setShowAddModal(true)} className="mt-4">
                Add Your First Processor
              </Button>
            </div>
          </Card>
        ) : (
          processors.map((processor) => {
            const config = processorConfig[processor.processorType as ProcessorType]
            const Icon = config.icon
            return (
              <Card key={processor.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      {/* Icon */}
                      <div className={`p-3 rounded-lg ${config.bgColor} ${config.borderColor} border`}>
                        <Icon className={`w-6 h-6 ${config.color}`} />
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h4 className="font-semibold text-lg">{config.label}</h4>
                          <div className="flex items-center space-x-2">
                            <Badge 
                              variant={processor.isActive ? 'success' : 'secondary'}
                              className="flex items-center"
                            >
                              {processor.isActive ? (
                                <><CheckCircle className="w-3 h-3 mr-1" /> Active</>
                              ) : (
                                <><XCircle className="w-3 h-3 mr-1" /> Inactive</>
                              )}
                            </Badge>
                            <Badge 
                              variant={processor.isTestMode ? 'warning' : 'success'}
                              className="flex items-center"
                            >
                              {processor.isTestMode ? (
                                <><TestTube className="w-3 h-3 mr-1" /> Test</>
                              ) : (
                                <><Zap className="w-3 h-3 mr-1" /> Live</>
                              )}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{config.description}</p>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center space-x-2">
                      {processor.isActive && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleTestPayment(processor)}
                          disabled={testingProcessor === processor.id}
                          className="flex items-center"
                        >
                          {testingProcessor === processor.id ? (
                            <><Spinner className="w-4 h-4 mr-1" /> Testing...</>
                          ) : (
                            <><TestTube className="w-4 h-4 mr-1" /> Test Payment</>
                          )}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleToggleProcessor(processor.id, !processor.isActive)}
                        className="flex items-center"
                      >
                        {processor.isActive ? (
                          <><XCircle className="w-4 h-4 mr-1" /> Deactivate</>
                        ) : (
                          <><CheckCircle className="w-4 h-4 mr-1" /> Activate</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleDeleteProcessor(processor.id)}
                        className="text-red-600 hover:text-red-700"
                        data-testid="delete-processor"
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              
              {processor.webhookSecret && (
                <div className="mt-4 p-3 bg-gray-50 rounded">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-700">Webhook URL:</span>
                      <div className="mt-1 flex items-center space-x-2">
                        <code className="text-xs bg-gray-200 px-2 py-1 rounded flex-1 overflow-x-auto">
                          {getWebhookUrl(processor.processorType)}
                        </code>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => copyWebhookUrl(processor.processorType)}
                          className="flex-shrink-0"
                        >
                          {copiedWebhook === processor.processorType ? (
                            <><CheckCircle className="w-4 h-4 mr-1" /> Copied!</>
                          ) : (
                            <><Copy className="w-4 h-4 mr-1" /> Copy</>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              </Card>
            )
          })
        )}
      </div>

      {/* Add Processor Button */}
      <Button onClick={() => setShowAddModal(true)}>
        Add Payment Processor
      </Button>

      {/* Add Processor Modal */}
      <Modal
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          resetForm()
        }}
      >
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Add Payment Processor</h2>
          {/* Processor Selection */}
          {!selectedProcessor ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Select a payment processor to configure:</p>
              
              {Object.values(ProcessorType).map((type) => {
                const config = processorConfig[type]
                const Icon = config.icon
                return (
                  <Card
                    key={type}
                    className={`p-4 transition-all ${
                      config.available 
                        ? 'cursor-pointer hover:border-blue-500 hover:shadow-md' 
                        : 'opacity-60 cursor-not-allowed'
                    }`}
                    onClick={() => config.available && setSelectedProcessor(type)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-lg ${config.bgColor} ${config.borderColor} border`}>
                        <Icon className={`w-5 h-5 ${config.color}`} />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold flex items-center">
                          {config.label}
                          {!config.available && (
                            <Badge variant="secondary" className="ml-2">Coming Soon</Badge>
                          )}
                        </h4>
                        <p className="text-sm text-gray-500 mt-1">{config.description}</p>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          ) : (
            <>
              {/* Back button */}
              <button
                onClick={() => setSelectedProcessor(null)}
                className="text-sm text-blue-600 hover:underline"
              >
                ← Back to processors
              </button>

              {/* Test/Live Mode Toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <label className="text-sm font-medium">Mode</label>
                <div className="flex items-center space-x-2">
                  <button
                    className={`px-3 py-1 text-sm rounded ${
                      testMode ? 'bg-yellow-500 text-white' : 'bg-gray-200'
                    }`}
                    onClick={() => setTestMode(true)}
                  >
                    Test
                  </button>
                  <button
                    className={`px-3 py-1 text-sm rounded ${
                      !testMode ? 'bg-green-500 text-white' : 'bg-gray-200'
                    }`}
                    onClick={() => setTestMode(false)}
                  >
                    Live
                  </button>
                </div>
              </div>

              {/* Processor-specific form */}
              {renderProcessorForm()}

              {/* Action buttons */}
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowAddModal(false)
                    resetForm()
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddProcessor}
                  disabled={saving || selectedProcessor !== ProcessorType.STRIPE}
                >
                  {saving ? 'Adding...' : 'Add Processor'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}