import { randomBytes } from 'crypto'

/**
 * Generates a new API key with the format: tab_{environment}_{32 random chars}
 * @param environment - 'live' or 'test'
 * @returns The generated API key
 */
export function generateApiKey(environment: 'live' | 'test' = 'live'): string {
  const prefix = `tab_${environment}_`
  const randomPart = randomBytes(16).toString('hex') // 32 characters
  return prefix + randomPart
}