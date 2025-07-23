#!/usr/bin/env node

/**
 * DEVELOPMENT ONLY - Ngrok webhook helper
 * Manages Stripe webhooks when using ngrok for local development
 * 
 * Usage:
 *   npm run webhook:ngrok setup   - Create/update webhook in Stripe
 *   npm run webhook:ngrok sync    - Sync webhook ID to show "configured" in UI
 *   npm run webhook:ngrok clean   - Remove old ngrok webhooks
 */

const { createClient } = require('@supabase/supabase-js')
const Stripe = require('stripe')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })

async function setup() {
  console.log('🚀 Setting up ngrok webhook...\n')
  
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl?.includes('ngrok')) {
    console.error('❌ Not using ngrok URL. Set NEXT_PUBLIC_APP_URL to your ngrok URL')
    return
  }
  
  const webhookUrl = `${appUrl}/api/v1/webhooks/stripe`
  console.log('📡 Webhook URL:', webhookUrl)
  
  try {
    // Check existing webhooks
    const existing = await stripe.webhookEndpoints.list({ limit: 100 })
    const current = existing.data.find(w => w.url === webhookUrl)
    
    if (current) {
      console.log('\n✅ Webhook already exists')
      console.log('   ID:', current.id)
      console.log('   Secret:', current.secret)
    } else {
      // Clean old ngrok webhooks
      const oldWebhooks = existing.data.filter(w => 
        w.url.includes('ngrok') && w.url.includes('/api/v1/webhooks/stripe')
      )
      
      for (const old of oldWebhooks) {
        await stripe.webhookEndpoints.del(old.id)
        console.log(`🗑️  Deleted old webhook: ${old.url}`)
      }
      
      // Create new webhook
      const webhook = await stripe.webhookEndpoints.create({
        url: webhookUrl,
        enabled_events: [
          'checkout.session.completed',
          'payment_intent.succeeded',
          'payment_intent.payment_failed',
          'charge.succeeded',
          'charge.failed',
          'charge.refunded'
        ],
        description: 'Tab API Development (ngrok)'
      })
      
      console.log('\n✅ Created new webhook')
      console.log('   ID:', webhook.id)
      console.log('   Secret:', webhook.secret)
      console.log('\n📋 Update your .env.local:')
      console.log(`   STRIPE_WEBHOOK_SECRET=${webhook.secret}`)
    }
    
    console.log('\n💡 Run "npm run webhook:ngrok sync" to update UI status')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

async function sync() {
  console.log('🔄 Syncing webhook ID to database...\n')
  
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('❌ Not authenticated')
      return
    }
    
    // Find webhook in Stripe
    const webhooks = await stripe.webhookEndpoints.list({ limit: 100 })
    const current = webhooks.data.find(w => 
      w.url === `${process.env.NEXT_PUBLIC_APP_URL}/api/v1/webhooks/stripe`
    )
    
    if (!current) {
      console.error('❌ No webhook found. Run "npm run webhook:ngrok setup" first')
      return
    }
    
    // Update processor
    const { data: processors } = await supabase
      .from('merchant_processors')
      .select('*')
      .eq('merchant_id', user.id)
      .eq('processor_type', 'stripe')
    
    if (processors?.[0]) {
      const { error } = await supabase
        .from('merchant_processors')
        .update({ 
          metadata: { 
            ...processors[0].metadata, 
            webhookId: current.id 
          }
        })
        .eq('id', processors[0].id)
      
      if (!error) {
        console.log('✅ Webhook ID synced')
        console.log('   UI should now show webhook as "configured"')
      } else {
        console.error('❌ Error updating processor:', error)
      }
    } else {
      console.log('❌ No Stripe processor found')
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

async function clean() {
  console.log('🧹 Cleaning up old ngrok webhooks...\n')
  
  try {
    const webhooks = await stripe.webhookEndpoints.list({ limit: 100 })
    const ngrokWebhooks = webhooks.data.filter(w => 
      w.url.includes('ngrok') && w.url.includes('/api/v1/webhooks/stripe')
    )
    
    if (ngrokWebhooks.length === 0) {
      console.log('✅ No old webhooks to clean')
      return
    }
    
    for (const webhook of ngrokWebhooks) {
      await stripe.webhookEndpoints.del(webhook.id)
      console.log(`🗑️  Deleted: ${webhook.url}`)
    }
    
    console.log(`\n✅ Cleaned up ${ngrokWebhooks.length} old webhook(s)`)
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

// Parse command
const command = process.argv[2]

switch (command) {
  case 'setup':
    setup()
    break
  case 'sync':
    sync()
    break
  case 'clean':
    clean()
    break
  default:
    console.log('Usage:')
    console.log('  npm run webhook:ngrok setup   - Create/update webhook in Stripe')
    console.log('  npm run webhook:ngrok sync    - Sync webhook ID to UI')
    console.log('  npm run webhook:ngrok clean   - Remove old ngrok webhooks')
}