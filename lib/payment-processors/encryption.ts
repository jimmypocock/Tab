import crypto from 'crypto'

// Use environment variable for encryption key or generate one
const ENCRYPTION_KEY = process.env.PAYMENT_PROCESSOR_ENCRYPTION_KEY || 
  crypto.scryptSync(
    process.env.DATABASE_URL || 'default-salt', 
    'salt', 
    32
  ).toString('hex')

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16

export class EncryptionService {
  private static key = Buffer.from(ENCRYPTION_KEY, 'hex')

  static encrypt(data: any): string {
    const text = JSON.stringify(data)
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv)
    
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const tag = cipher.getAuthTag()
    
    // Combine iv + tag + encrypted data
    return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted
  }

  static decrypt(encryptedData: string): any {
    const parts = encryptedData.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format')
    }
    
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