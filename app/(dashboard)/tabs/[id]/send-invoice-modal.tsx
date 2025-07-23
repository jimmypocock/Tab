'use client'

import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X, Mail, Plus } from 'lucide-react'

interface SendInvoiceModalProps {
  isOpen: boolean
  onClose: () => void
  tabId: string
  defaultEmail: string
  customerName?: string
  onSend: (emails: string[]) => Promise<void>
}

export function SendInvoiceModal({ 
  isOpen, 
  onClose, 
  tabId, 
  defaultEmail, 
  customerName,
  onSend 
}: SendInvoiceModalProps) {
  const [emails, setEmails] = useState<string[]>([defaultEmail])
  const [newEmail, setNewEmail] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addEmail = () => {
    const trimmed = newEmail.trim()
    if (trimmed && isValidEmail(trimmed) && !emails.includes(trimmed)) {
      setEmails([...emails, trimmed])
      setNewEmail('')
      setError(null)
    } else if (!isValidEmail(trimmed)) {
      setError('Please enter a valid email address')
    }
  }

  const removeEmail = (email: string) => {
    setEmails(emails.filter(e => e !== email))
  }

  const handleSend = async () => {
    if (emails.length === 0) {
      setError('Please add at least one recipient')
      return
    }
    
    setIsSending(true)
    setError(null)
    
    try {
      await onSend(emails)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to send invoice')
    } finally {
      setIsSending(false)
    }
  }

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <Mail className="w-5 h-5 mr-2" />
                    Send Invoice
                  </div>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Title>

                <div className="mt-4">
                  <p className="text-sm text-gray-500">
                    Send invoice to {customerName || 'customer'}. You can add multiple email addresses.
                  </p>

                  <div className="mt-4 space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Recipients
                    </label>
                    
                    {/* Existing emails */}
                    {emails.length === 0 ? (
                      <div className="text-sm text-gray-500 italic py-2">
                        No recipients added. Add at least one email address to send the invoice.
                      </div>
                    ) : (
                      emails.map((email) => (
                        <div key={email} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md">
                          <span className="text-sm">{email}</span>
                          <button
                            onClick={() => removeEmail(email)}
                            className="text-gray-400 hover:text-red-500"
                            title="Remove recipient"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}

                    {/* Add new email */}
                    <div className="flex items-center space-x-2">
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addEmail()}
                        placeholder="Add another email..."
                        className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      />
                      <button
                        onClick={addEmail}
                        disabled={!newEmail.trim()}
                        className="inline-flex items-center p-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {error && (
                    <p className="mt-2 text-sm text-red-600">{error}</p>
                  )}
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    onClick={onClose}
                    disabled={isSending}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleSend}
                    disabled={isSending || emails.length === 0}
                  >
                    {isSending ? 'Sending...' : `Send to ${emails.length} recipient${emails.length > 1 ? 's' : ''}`}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}