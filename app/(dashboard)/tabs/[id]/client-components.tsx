'use client'

import { useState } from 'react'
import { Copy, Mail } from 'lucide-react'

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
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

export function SendInvoiceButton({ tabId }: { tabId: string }) {
  const handleSendInvoice = () => {
    // TODO: Implement invoice sending for tab: ${tabId}
    alert(`Invoice sending not yet implemented for tab: ${tabId}`)
  }

  return (
    <button
      type="button"
      onClick={handleSendInvoice}
      className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
    >
      <Mail className="-ml-0.5 mr-1.5 h-5 w-5" aria-hidden="true" />
      Send Invoice
    </button>
  )
}