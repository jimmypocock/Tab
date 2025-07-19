'use client'

import React, { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

interface PaymentLinkButtonProps {
  tabId: string
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  className?: string
  baseUrl?: string
}

export function PaymentLinkButton({ 
  tabId, 
  variant = 'ghost',
  size = 'sm',
  showIcon = true,
  className,
  baseUrl
}: PaymentLinkButtonProps) {
  const [copied, setCopied] = useState(false)
  
  const handleCopy = async () => {
    const origin = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '')
    const link = `${origin}/pay/${tabId}`
    
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy payment link:', err)
    }
  }
  
  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleCopy}
      className={cn('transition-all', className)}
      aria-label="Copy payment link"
    >
      {copied ? (
        <>
          {showIcon && <Check className="h-4 w-4 mr-1" />}
          Copied!
        </>
      ) : (
        <>
          {showIcon && <Copy className="h-4 w-4 mr-1" />}
          Copy Link
        </>
      )}
    </Button>
  )
}