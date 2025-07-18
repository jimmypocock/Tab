#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log('🚀 Tab App Setup Script\n');

  // Check if this is initial setup
  const isInitialSetup = !fs.existsSync('.env.local');

  if (isInitialSetup) {
    console.log('Welcome to Tab! Let\'s get you set up.\n');
    
    // Install dependencies first
    console.log('📦 Installing dependencies...');
    execSync('npm install', { stdio: 'inherit' });
    console.log('');
  }

  // Ask user about their setup preference
  console.log('How would you like to set up your development environment?\n');
  console.log('1. Local Supabase (Recommended - requires Docker)');
  console.log('2. Cloud Supabase (Easier - requires internet)\n');
  
  const choice = await question('Enter your choice (1 or 2): ');
  console.log('');

  if (choice === '1') {
    await setupLocalSupabase();
  } else if (choice === '2') {
    await setupCloudSupabase();
  } else {
    console.log('❌ Invalid choice. Please run the script again.');
    process.exit(1);
  }

  rl.close();
}

async function setupLocalSupabase() {
  console.log('🐳 Setting up local Supabase...\n');

  // Check if Docker is running
  try {
    execSync('docker info', { stdio: 'ignore' });
  } catch (error) {
    console.error('❌ Docker is not running. Please start Docker Desktop and try again.');
    console.log('\nDownload Docker Desktop from: https://www.docker.com/products/docker-desktop/');
    process.exit(1);
  }

  // Check/Install Supabase CLI
  try {
    execSync('supabase --version', { stdio: 'ignore' });
  } catch (error) {
    console.log('📦 Installing Supabase CLI...');
    console.log('Supabase CLI needs to be installed via Homebrew on macOS.\n');
    
    // Check if Homebrew is installed
    try {
      execSync('brew --version', { stdio: 'ignore' });
      console.log('Installing Supabase CLI via Homebrew...');
      try {
        execSync('brew install supabase/tap/supabase', { stdio: 'inherit' });
      } catch (brewError) {
        console.error('❌ Failed to install Supabase CLI via Homebrew.');
        console.log('\nAlternatively, you can download directly from:');
        console.log('https://github.com/supabase/cli/releases');
        process.exit(1);
      }
    } catch (brewCheckError) {
      console.error('❌ Homebrew is not installed.');
      console.log('\nPlease install Supabase CLI using one of these methods:');
      console.log('1. Install Homebrew first: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"');
      console.log('   Then run: brew install supabase/tap/supabase');
      console.log('\n2. Or download directly from: https://github.com/supabase/cli/releases');
      process.exit(1);
    }
  }

  // Initialize Supabase if needed
  if (!fs.existsSync(path.join(process.cwd(), 'supabase'))) {
    console.log('🔧 Initializing Supabase...');
    execSync('supabase init', { stdio: 'inherit' });
    
    // Configure project name to "Tab"
    console.log('🏷️  Setting project name to "Tab"...');
    const configPath = path.join(process.cwd(), 'supabase', 'config.toml');
    if (fs.existsSync(configPath)) {
      let config = fs.readFileSync(configPath, 'utf-8');
      
      // Add project_id if it doesn't exist
      if (!config.includes('project_id')) {
        config = `project_id = "tab"\n\n${config}`;
      }
      
      // Update auth URLs to use port 1235
      config = config.replace(/site_url = "http:\/\/127\.0\.0\.1:3000"/, 'site_url = "http://127.0.0.1:1235"');
      config = config.replace(/additional_redirect_urls = \["https:\/\/127\.0\.0\.1:3000"\]/, 'additional_redirect_urls = ["https://127.0.0.1:1235"]');
      
      fs.writeFileSync(configPath, config);
      console.log('✅ Project configured as "Tab"');
    }
  }

  // Start Supabase
  console.log('🐘 Starting local Supabase services...');
  
  // Temporarily move seed.sql to prevent auto-seeding before schema is ready
  const seedPath = 'supabase/seed.sql';
  const tempSeedPath = 'supabase/seed.sql.tmp';
  if (fs.existsSync(seedPath)) {
    fs.renameSync(seedPath, tempSeedPath);
  }
  
  try {
    const output = execSync('supabase start', { encoding: 'utf-8' });
    console.log(output);
    
    // Move seed file back
    if (fs.existsSync(tempSeedPath)) {
      fs.renameSync(tempSeedPath, seedPath);
    }
    
    // Parse credentials
    const anonKeyMatch = output.match(/anon key: (.+)/);
    const serviceKeyMatch = output.match(/service_role key: (.+)/);
    
    if (anonKeyMatch && serviceKeyMatch) {
      await createLocalEnvFile(anonKeyMatch[1], serviceKeyMatch[1]);
    }
    
    console.log('\n✅ Local Supabase is running!');
    console.log('\n📊 Supabase Studio: http://localhost:54323');
    console.log('📧 Email testing: http://localhost:54324');
    
    // Push database schema
    console.log('\n🔨 Creating database tables...');
    try {
      // First, apply Supabase migrations (includes RLS and policies)
      console.log('📋 Applying database migrations...');
      execSync('npx supabase db push --local', { stdio: 'inherit' });
      
      // Then push Drizzle schema
      execSync('npm run db:push:local', { stdio: 'inherit' });
      console.log('✅ Database schema created successfully!');
      
      // Optionally seed data if seed.sql exists
      if (fs.existsSync('supabase/seed.sql')) {
        console.log('\n🌱 Seeding test data...');
        try {
          execSync('psql postgresql://postgres:postgres@localhost:54322/postgres < supabase/seed.sql', { stdio: 'inherit' });
          console.log('✅ Test data seeded successfully!');
        } catch (seedError) {
          console.log('⚠️  Seeding failed (optional). You can manually seed later if needed.');
        }
      }
    } catch (schemaError) {
      console.error('❌ Failed to create database schema:', schemaError.message);
      console.log('\nPlease run manually:');
      console.log('  npx supabase db push --local');
      console.log('  npm run db:push:local');
    }
    
  } catch (error) {
    // Move seed file back if there was an error
    if (fs.existsSync(tempSeedPath)) {
      fs.renameSync(tempSeedPath, seedPath);
    }
    
    if (error.message.includes('is already running')) {
      console.log('✅ Supabase is already running locally');
      
      // Try to get existing credentials
      try {
        const status = execSync('supabase status', { encoding: 'utf-8' });
        console.log('\nℹ️  Update your .env.local with the credentials shown above if needed.');
      } catch (statusError) {
        console.log('\n⚠️  Could not retrieve Supabase credentials. Check your .env.local');
      }
    } else {
      console.error('❌ Failed to start Supabase:', error.message);
      process.exit(1);
    }
  }

  await finalSteps(true);
}

async function setupCloudSupabase() {
  console.log('☁️  Setting up cloud Supabase...\n');

  if (!fs.existsSync('.env.local')) {
    console.log('📝 Creating .env.local from .env.example...');
    fs.copyFileSync('.env.example', '.env.local');
    console.log('✅ .env.local created\n');
  }

  console.log('📋 Cloud Setup Steps:\n');
  console.log('1. Create a Supabase project:');
  console.log('   - Go to https://app.supabase.com');
  console.log('   - Click "New project"');
  console.log('   - Choose a name and password\n');
  
  console.log('2. Get your project credentials:');
  console.log('   - Project URL: Settings → API → Project URL');
  console.log('   - Anon Key: Settings → API → anon public');
  console.log('   - Service Key: Settings → API → service_role');
  console.log('   - Database URL: Settings → Database → Connection string\n');
  
  console.log('3. Update .env.local with your credentials\n');
  
  const ready = await question('Have you updated .env.local with your Supabase credentials? (y/n): ');
  
  if (ready.toLowerCase() !== 'y') {
    console.log('\n⚠️  Please update .env.local and run the setup again.');
    process.exit(0);
  }

  await finalSteps(false);
}

async function createLocalEnvFile(anonKey, serviceKey) {
  const envContent = `# Local Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}
SUPABASE_SERVICE_ROLE_KEY=${serviceKey}

# Local Database URL
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
SUPABASE_DB_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Stripe Configuration (add your test keys)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:1235
NODE_ENV=development

# Optional: Redis Configuration
# UPSTASH_REDIS_REST_URL=your-redis-url
# UPSTASH_REDIS_REST_TOKEN=your-redis-token
`;

  fs.writeFileSync('.env.local', envContent);
  console.log('✅ Created .env.local with local credentials');
}

async function finalSteps(isLocal) {
  console.log('\n🔧 Final Setup Steps:\n');

  // Database setup
  if (!isLocal) {
    console.log('1. Push database schema:');
    console.log('   npm run db:push');
  }
  
  if (isLocal) {
    console.log('1. (Optional) Seed additional test data:');
    console.log('   psql postgresql://postgres:postgres@localhost:54322/postgres < supabase/seed.sql');
  }
  
  // Stripe setup
  console.log('\n3. Set up Stripe:');
  console.log('   - Get test keys from https://dashboard.stripe.com');
  console.log('   - Update STRIPE_* variables in .env.local');
  console.log('   - For webhooks: stripe listen --forward-to localhost:1235/api/v1/webhooks/stripe');
  
  console.log('\n4. Start development:');
  console.log('   npm run dev');
  
  console.log('\n📚 Documentation:');
  console.log('   - Local setup guide: /docs/LOCAL_DEVELOPMENT.md');
  console.log('   - API documentation: /docs/API.md');
  
  if (isLocal) {
    console.log('\n🔑 Test API Keys for local development:');
    console.log('   - tab_test_12345678901234567890123456789012');
    console.log('   - tab_test_98765432109876543210987654321098');
  }
  
  console.log('\n✨ Happy coding!');
}

// Run the script
main().catch(console.error);