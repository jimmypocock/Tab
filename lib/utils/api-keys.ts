import crypto from 'crypto'

export function generateApiKey(): string {
  const prefix = process.env.NODE_ENV === 'production' ? 'tab_live' : 'tab_test'
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