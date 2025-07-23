import crypto from 'crypto'
import { logger } from '@/lib/logger'

// Enforce encryption key requirement for production
const ENCRYPTION_KEY = (() => {
  const key = process.env.PAYMENT_PROCESSOR_ENCRYPTION_KEY
  
  if (!key) {
    const message = 'PAYMENT_PROCESSOR_ENCRYPTION_KEY environment variable is required for secure credential storage'
    
    // Only allow missing key in development/test environments
    if (process.env.NODE_ENV === 'production') {
      throw new Error(message)
    }
    
    logger.warn(message + ' - using temporary key for development only')
    // Generate a consistent development key (NOT FOR PRODUCTION)
    return crypto.scryptSync('development-only-key', 'salt', 32).toString('hex')
  }
  
  // Validate key format and length
  if (!/^[a-f0-9]{64}$/i.test(key)) {
    throw new Error('PAYMENT_PROCESSOR_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }
  
  return key
})()

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const KEY_VERSION = '1' // For future key rotation support

export class EncryptionService {
  private static key = Buffer.from(ENCRYPTION_KEY, 'hex')

  static encrypt(data: any): string {
    const text = JSON.stringify(data)
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv)
    
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const tag = cipher.getAuthTag()
    
    // Include version for future key rotation support
    // Format: v{version}:{iv}:{tag}:{encrypted}
    return `v${KEY_VERSION}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`
  }

  static decrypt(encryptedData: string): any {
    const parts = encryptedData.split(':')
    
    // Handle versioned format (v1:iv:tag:encrypted)
    if (parts[0]?.startsWith('v')) {
      if (parts.length !== 4) {
        throw new Error('Invalid encrypted data format')
      }
      
      const version = parts[0]
      if (version !== `v${KEY_VERSION}`) {
        // In the future, handle different versions here
        throw new Error(`Unsupported encryption version: ${version}`)
      }
      
      const iv = Buffer.from(parts[1]!, 'hex')
      const tag = Buffer.from(parts[2]!, 'hex')
      const encrypted = parts[3]!
      
      const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv)
      decipher.setAuthTag(tag)
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      
      return JSON.parse(decrypted)
    }
    
    // Handle legacy format (iv:tag:encrypted) for backward compatibility
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format')
    }
    
    logger.warn('Decrypting legacy format credential - consider re-encrypting')
    
    const iv = Buffer.from(parts[0]!, 'hex')
    const tag = Buffer.from(parts[1]!, 'hex')
    const encrypted = parts[2]!
    
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv)
    decipher.setAuthTag(tag)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return JSON.parse(decrypted)
  }

  // Hash sensitive data for comparison without decryption
  static hash(data: string): string {
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex')
  }

  // Generate a secure random webhook secret
  static generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex')
  }
}