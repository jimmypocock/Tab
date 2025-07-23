#!/usr/bin/env node

const crypto = require('crypto')

console.log('🔐 Generating secure encryption key for payment processor credentials...\n')

// Generate a cryptographically secure random key
const key = crypto.randomBytes(32).toString('hex')

console.log('Your encryption key:')
console.log('═'.repeat(70))
console.log(key)
console.log('═'.repeat(70))

console.log('\n📋 Instructions:')
console.log('1. Copy the key above')
console.log('2. Add it to your .env.local file:')
console.log('   PAYMENT_PROCESSOR_ENCRYPTION_KEY=' + key)
console.log('\n⚠️  Important:')
console.log('- Keep this key secret and secure')
console.log('- Never commit it to version control')
console.log('- Store it in a secure password manager')
console.log('- Use different keys for development and production')
console.log('- Back up this key - losing it means losing access to encrypted data')

console.log('\n✅ Key validation:')
console.log(`- Length: ${key.length} characters (expected: 64)`)
console.log(`- Format: ${/^[a-f0-9]{64}$/i.test(key) ? 'Valid hex string' : 'Invalid format'}`)
console.log(`- Entropy: ${32 * 8} bits (military-grade)`)