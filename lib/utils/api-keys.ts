import crypto from 'crypto'

export function generateApiKey(type: 'org' | 'tab' = 'tab', environment: 'test' | 'live' | 'corp' = 'test'): string {
  // Handle different key types
  let prefix: string
  if (type === 'org') {
    if (environment === 'corp') {
      prefix = 'org_corp'
    } else {
      prefix = environment === 'live' ? 'org_live' : 'org_test'
    }
  } else {
    prefix = environment === 'live' ? 'tab_live' : 'tab_test'
  }
  
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let key = ''
  
  // Generate 32 random characters
  for (let i = 0; i < 32; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length)
    key += chars[randomIndex]
  }
  
  return `${prefix}_${key}`
}

export async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(apiKey)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}