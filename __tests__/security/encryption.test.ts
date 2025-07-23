import { EncryptionService } from '@/lib/payment-processors/encryption'

describe('EncryptionService Security Tests', () => {
  const testData = {
    secretKey: 'sk_test_abc123',
    publishableKey: 'pk_test_xyz789',
  }

  describe('Encryption Key Validation', () => {
    it('should validate encryption key format', () => {
      // Save original env
      const originalKey = process.env.PAYMENT_PROCESSOR_ENCRYPTION_KEY
      
      try {
        // Test invalid key formats
        const invalidKeys = [
          'too-short',
          'not-hex-characters!@#$',
          '0123456789abcdef', // Too short (16 chars instead of 64)
          'gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg', // Invalid hex (g is not hex)
        ]
        
        invalidKeys.forEach(invalidKey => {
          process.env.PAYMENT_PROCESSOR_ENCRYPTION_KEY = invalidKey
          
          // Force module to re-evaluate
          jest.resetModules()
          
          expect(() => {
            require('@/lib/payment-processors/encryption')
          }).toThrow('PAYMENT_PROCESSOR_ENCRYPTION_KEY must be a 64-character hex string')
        })
      } finally {
        // Restore original env
        process.env.PAYMENT_PROCESSOR_ENCRYPTION_KEY = originalKey
        jest.resetModules()
      }
    })
  })

  describe('Encryption and Decryption', () => {
    it('should encrypt and decrypt data successfully', () => {
      const encrypted = EncryptionService.encrypt(testData)
      const decrypted = EncryptionService.decrypt(encrypted)
      
      expect(decrypted).toEqual(testData)
      expect(encrypted).not.toContain(testData.secretKey)
      expect(encrypted).not.toContain(testData.publishableKey)
    })

    it('should produce different ciphertext for same plaintext (due to random IV)', () => {
      const encrypted1 = EncryptionService.encrypt(testData)
      const encrypted2 = EncryptionService.encrypt(testData)
      
      expect(encrypted1).not.toBe(encrypted2)
      
      // But both should decrypt to same value
      expect(EncryptionService.decrypt(encrypted1)).toEqual(testData)
      expect(EncryptionService.decrypt(encrypted2)).toEqual(testData)
    })

    it('should include version in encrypted output', () => {
      const encrypted = EncryptionService.encrypt(testData)
      expect(encrypted).toMatch(/^v1:/)
    })

    it('should handle legacy format for backward compatibility', () => {
      // Simulate legacy encrypted data (without version prefix)
      const legacyFormat = 'a1b2c3d4e5f6789012345678901234ef:1234567890abcdef1234567890abcdef:encrypteddata'
      
      // Should not throw and log warning
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      expect(() => {
        try {
          EncryptionService.decrypt(legacyFormat)
        } catch (e) {
          // Expected to fail decryption but format should be recognized
          if (e.message === 'Invalid encrypted data format') {
            throw e
          }
        }
      }).not.toThrow('Invalid encrypted data format')
      
      consoleSpy.mockRestore()
    })
  })

  describe('Data Integrity', () => {
    it('should detect tampering with authenticated encryption', () => {
      const encrypted = EncryptionService.encrypt(testData)
      
      // Tamper with the encrypted data
      const parts = encrypted.split(':')
      parts[3] = parts[3]!.substring(0, 10) + 'TAMPERED' + parts[3]!.substring(18)
      const tampered = parts.join(':')
      
      expect(() => {
        EncryptionService.decrypt(tampered)
      }).toThrow()
    })
  })

  describe('Security Best Practices', () => {
    it('should never expose credentials in error messages', () => {
      const invalidData = 'invalid:encrypted:data'
      
      try {
        EncryptionService.decrypt(invalidData)
      } catch (error: any) {
        expect(error.message).not.toContain('secret')
        expect(error.message).not.toContain('key')
        expect(error.message).not.toContain(testData.secretKey)
      }
    })

    it('should hash data consistently', () => {
      const hash1 = EncryptionService.hash('test-data')
      const hash2 = EncryptionService.hash('test-data')
      const hash3 = EncryptionService.hash('different-data')
      
      expect(hash1).toBe(hash2)
      expect(hash1).not.toBe(hash3)
      expect(hash1).toHaveLength(64) // SHA-256 produces 64 hex chars
    })

    it('should generate secure webhook secrets', () => {
      const secret1 = EncryptionService.generateWebhookSecret()
      const secret2 = EncryptionService.generateWebhookSecret()
      
      expect(secret1).not.toBe(secret2)
      expect(secret1).toHaveLength(64) // 32 bytes = 64 hex chars
      expect(secret1).toMatch(/^[a-f0-9]{64}$/i)
    })
  })
})