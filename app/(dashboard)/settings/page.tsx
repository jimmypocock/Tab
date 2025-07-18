'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Key, Copy, Trash2, Plus, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { createNewApiKey, deleteApiKey, getApiKeys } from './actions'

export default function SettingsPage() {
  const [apiKeys, setApiKeys] = useState<any[]>([])
  const [newKeyName, setNewKeyName] = useState('')
  const [newApiKey, setNewApiKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const searchParams = useSearchParams()
  const isWelcome = searchParams.get('welcome') === 'true'

  useEffect(() => {
    loadApiKeys()
  }, [])

  const loadApiKeys = async () => {
    const keys = await getApiKeys()
    setApiKeys(keys)
  }

  const handleCreateApiKey = async () => {
    const keyName = newKeyName.trim() || (apiKeys.length === 0 ? 'My First API Key' : `API Key ${apiKeys.length + 1}`)

    setLoading(true)
    try {
      const result = await createNewApiKey(keyName)
      
      if (result.error) {
        alert(result.error)
      } else if (result.apiKey) {
        setNewApiKey(result.apiKey)
        setNewKeyName('')
        await loadApiKeys()
      }
    } catch (error) {
      alert('Failed to create API key')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteApiKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return
    }

    const result = await deleteApiKey(keyId)
    if (result.error) {
      alert(result.error)
    } else {
      await loadApiKeys()
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Settings</h1>

      {/* Welcome Message for New Users */}
      {isWelcome && apiKeys.length === 0 && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-blue-800">Welcome to Tab!</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>Your account has been created successfully. To start using the Tab API, create your first API key.</p>
              </div>
              <div className="mt-3">
                <button
                  onClick={handleCreateApiKey}
                  disabled={loading}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Key className="h-3.5 w-3.5 mr-1" />
                  {loading ? 'Creating...' : 'Create My First API Key'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* API Keys Section */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            API Keys
          </h3>
          <div className="mt-2 max-w-xl text-sm text-gray-500">
            <p>Create and manage API keys for accessing the Tab API.</p>
          </div>

          {/* New API Key Display */}
          {newApiKey && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Key className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-yellow-800">
                    New API Key Created
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p className="mb-2">
                      Make sure to copy your API key now. You won't be able to see it again!
                    </p>
                    <div className="flex items-center space-x-2">
                      <code className="flex-1 bg-yellow-100 px-2 py-1 rounded text-xs font-mono">
                        {showKey ? newApiKey : '•'.repeat(40)}
                      </code>
                      <button
                        onClick={() => setShowKey(!showKey)}
                        className="p-1 text-yellow-600 hover:text-yellow-800"
                      >
                        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => copyToClipboard(newApiKey)}
                        className="p-1 text-yellow-600 hover:text-yellow-800"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                    {copied && (
                      <p className="mt-1 text-xs text-green-600">Copied to clipboard!</p>
                    )}
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        setNewApiKey(null)
                        setShowKey(false)
                      }}
                      className="text-sm font-medium text-yellow-800 hover:text-yellow-700"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Create New Key Form */}
          <div className="mt-5">
            <div className="sm:flex sm:items-center">
              <div className="w-full sm:max-w-xs">
                <label htmlFor="key-name" className="sr-only">
                  Key Name
                </label>
                <input
                  type="text"
                  name="key-name"
                  id="key-name"
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder={apiKeys.length === 0 ? "Optional - defaults to 'My First API Key'" : "Optional - defaults to 'API Key X'"}
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateApiKey()}
                />
              </div>
              <button
                onClick={handleCreateApiKey}
                disabled={loading}
                className="mt-3 w-full inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4 mr-1" />
                {loading ? 'Creating...' : 'Create New Key'}
              </button>
            </div>
          </div>

          {/* Existing Keys List */}
          <div className="mt-6">
            <ul className="divide-y divide-gray-200">
              {apiKeys.length === 0 ? (
                <li className="py-4 text-sm text-gray-500">
                  No API keys yet. Create your first key to start using the API.
                </li>
              ) : (
                apiKeys.map((key) => (
                  <li key={key.id} className="py-4 flex items-center justify-between">
                    <div className="flex items-center">
                      <Key className="h-5 w-5 text-gray-400" />
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">
                          {key.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {key.key_prefix}...{' '}
                          <span className="text-xs">
                            (Created: {new Date(key.created_at).toLocaleDateString()})
                          </span>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteApiKey(key.id)}
                      className="ml-4 text-sm font-medium text-red-600 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* API Documentation */}
      <div className="mt-8 bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            API Documentation
          </h3>
          <div className="mt-2 max-w-xl text-sm text-gray-500">
            <p>Learn how to integrate with the Tab API.</p>
          </div>
          <div className="mt-5">
            <a
              href="/docs/api"
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              View API Documentation
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}