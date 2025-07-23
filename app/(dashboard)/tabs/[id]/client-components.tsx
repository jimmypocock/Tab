'use client'

import { useState } from 'react'
import { Copy, Mail } from 'lucide-react'
import { SendInvoiceModal } from './send-invoice-modal'
import { useToast } from '@/lib/toast/toast-context'

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const { showToast } = useToast()

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    showToast({
      type: 'success',
      title: 'Copied to clipboard',
      duration: 2000,
    })
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
    >
      <Copy className="h-4 w-4" />
      {copied && <span className="ml-2">Copied!</span>}
    </button>
  )
}

interface SendInvoiceButtonProps {
  tabId: string
  customerEmail: string
  customerName?: string
}

export function SendInvoiceButton({ tabId, customerEmail, customerName }: SendInvoiceButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { showToast } = useToast()

  const handleSendInvoice = async (emails: string[]) => {
    try {
      const response = await fetch(`/api/tabs/${tabId}/invoice?send=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          recipientEmail: emails[0], // Primary recipient
          ccEmails: emails.slice(1)  // Additional recipients
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invoice')
      }

      showToast({
        type: 'success',
        title: 'Invoice sent successfully!',
        description: `Sent to ${emails.length} recipient${emails.length > 1 ? 's' : ''}`,
      })
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Failed to send invoice',
        description: error.message,
      })
      throw error // Re-throw so modal handles it
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        <Mail className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
        Send Invoice
      </button>

      <SendInvoiceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        tabId={tabId}
        defaultEmail={customerEmail}
        customerName={customerName}
        onSend={handleSendInvoice}
      />
    </>
  )
}