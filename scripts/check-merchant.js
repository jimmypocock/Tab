const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseServiceKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required')
  console.error('Please set it in your .env.local file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkMerchants() {
  console.log('Checking merchants table...')
  
  // Get all users
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers()
  if (usersError) {
    console.error('Error fetching users:', usersError)
    return
  }
  
  console.log(`\nFound ${users.users.length} users:`)
  for (const user of users.users) {
    console.log(`- User: ${user.email} (ID: ${user.id})`)
    
    // Check if merchant exists
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('*')
      .eq('id', user.id)
      .single()
    
    if (merchantError) {
      console.log(`  ❌ No merchant record found`)
    } else {
      console.log(`  ✅ Merchant exists: ${merchant.business_name}`)
    }
    
    // Check API keys
    const { data: apiKeys, error: keysError } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, is_active')
      .eq('merchant_id', user.id)
    
    if (apiKeys && apiKeys.length > 0) {
      console.log(`  📝 API Keys: ${apiKeys.length}`)
      apiKeys.forEach(key => {
        console.log(`     - ${key.name} (${key.key_prefix}...) - Active: ${key.is_active}`)
      })
    } else {
      console.log(`  📝 No API keys`)
    }
  }
}

checkMerchants()