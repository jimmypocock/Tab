# Stripe Setup Guide for Tab Application

This guide walks you through setting up Stripe for the Tab payment collection platform, including test environment configuration, API keys, and webhook setup.

## Quick Links to Stripe Documentation

### Essential Documentation

- **[Stripe Dashboard](https://dashboard.stripe.com/)** - Main control panel
- **[API Keys Documentation](https://docs.stripe.com/keys)** - Understanding and managing API keys
- **[Test Mode Documentation](https://docs.stripe.com/test-mode)** - Working in the test environment
- **[Webhook Documentation](https://docs.stripe.com/webhooks)** - Setting up event notifications
- **[Payment Intents Guide](https://docs.stripe.com/payments/payment-intents)** - Core payment processing
- **[Testing Documentation](https://docs.stripe.com/testing)** - Test cards and scenarios

### Developer Resources

- **[API Reference](https://docs.stripe.com/api)** - Complete API documentation
- **[Stripe CLI Documentation](https://docs.stripe.com/stripe-cli)** - Command-line tools
- **[Node.js SDK Documentation](https://github.com/stripe/stripe-node)** - Library reference
- **[Security Best Practices](https://docs.stripe.com/security)** - Keeping your integration secure

---

## Step 1: Create a Stripe Account

1. **Sign Up**
   - Go to [https://dashboard.stripe.com/register](https://dashboard.stripe.com/register)
   - Enter your email and create a password
   - Verify your email address

2. **Initial Setup** (Can skip for testing)
   - You'll be prompted for business details
   - For testing purposes, you can skip most of this
   - You can always complete it later for production use

3. **Dashboard Access**
   - Once logged in, you'll see the Stripe Dashboard
   - Notice the **Test mode** toggle in the top right
   - Ensure you're in **Test mode** (not Live mode)

---

## Step 2: Get Your Test API Keys

1. **Navigate to API Keys**
   - In the Dashboard, click **Developers** → **API keys**
   - Or go directly to: [https://dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys)

2. **Locate Your Keys**
   - **Publishable key**: Starts with `pk_test_`
   - **Secret key**: Starts with `sk_test_` (click "Reveal test key" to see it)

3. **Copy Your Keys**

   ```bash
   # Example keys (yours will be different):
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51ABC...xyz
   STRIPE_SECRET_KEY=sk_test_51ABC...xyz
   ```

4. **Update .env.local**

   ```bash
   # In your Tab project, update these values:
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
   STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
   ```

---

## Step 3: Install Stripe CLI (Required for Webhooks)

The Stripe CLI is essential for testing webhooks locally.

### macOS (Homebrew)

```bash
brew install stripe/stripe-cli/stripe
```

### macOS/Linux (Direct Download)

```bash
# Download the latest release from:
# https://github.com/stripe/stripe-cli/releases

# Or use curl (check for latest version):
curl -L https://github.com/stripe/stripe-cli/releases/download/v1.17.1/stripe_1.17.1_mac-os_x86_64.tar.gz | tar -xz
sudo mv stripe /usr/local/bin
```

### Windows

Download the .exe from: [https://github.com/stripe/stripe-cli/releases](https://github.com/stripe/stripe-cli/releases)

### Verify Installation

```bash
stripe --version
```

---

## Step 4: Authenticate Stripe CLI

1. **Login to Stripe CLI**

   ```bash
   stripe login
   ```

2. **Complete Browser Authentication**
   - Your browser will open
   - Confirm the pairing request
   - The CLI will confirm successful authentication

3. **Verify Connection**

   ```bash
   # List recent events
   stripe events list --limit 5
   ```

---

## Step 5: Set Up Webhook Testing

### Create Webhook Endpoint in Dashboard (Optional for Production)

1. **Navigate to Webhooks**
   - Go to **Developers** → **Webhooks**
   - Or visit: [https://dashboard.stripe.com/test/webhooks](https://dashboard.stripe.com/test/webhooks)

2. **Add Endpoint** (for production/staging)
   - Click **"Add endpoint"**
   - Endpoint URL: `https://your-domain.com/api/v1/webhooks/stripe`
   - Select events to listen for:
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `charge.refunded`
     - `charge.dispute.created`

3. **Get Webhook Signing Secret**
   - After creating, click on the webhook
   - Reveal and copy the **Signing secret** (starts with `whsec_`)

### Local Development with Stripe CLI

For local development, use the Stripe CLI to forward webhooks:

1. **Start Webhook Forwarding**

   ```bash
   # Run this in a separate terminal:
   npm run stripe:listen
   
   # Or manually:
   stripe listen --forward-to localhost:1235/api/v1/webhooks/stripe
   ```

2. **Get Local Webhook Secret**
   - The CLI will output: `Ready! Your webhook signing secret is whsec_...`
   - Copy this value

3. **Update .env.local**

   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_YOUR_LOCAL_SECRET_HERE
   ```

---

## Step 6: Test Your Integration

### Quick Test Script

Create a test file `test-stripe.js`:

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function testStripeConnection() {
  try {
    // Create a test product
    const product = await stripe.products.create({
      name: 'Test Product',
    });
    console.log('✅ Successfully connected to Stripe!');
    console.log('Product ID:', product.id);
    
    // Clean up
    await stripe.products.del(product.id);
    console.log('✅ Test product cleaned up');
  } catch (error) {
    console.error('❌ Stripe connection failed:', error.message);
  }
}

testStripeConnection();
```

Run it:

```bash
node test-stripe.js
```

### Test Cards for Development

Use these test card numbers (any future expiry, any CVC, any ZIP):

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Insufficient Funds**: `4000 0000 0000 9995`
- **3D Secure Required**: `4000 0025 0000 3155`
- **3D Secure 2 Required**: `4000 0000 0000 3220`

Full list: [https://docs.stripe.com/testing#cards](https://docs.stripe.com/testing#cards)

---

## Step 7: Production Considerations

When ready for production:

1. **Complete Business Verification**
   - Fill out all required business information
   - Submit required documents
   - Wait for Stripe approval

2. **Switch to Live Mode**
   - Toggle to "Live mode" in Dashboard
   - Get your live API keys (start with `pk_live_` and `sk_live_`)
   - Update production environment variables

3. **Set Up Production Webhooks**
   - Add your production webhook endpoint
   - Use a different signing secret for production
   - Monitor webhook health in Dashboard

4. **Security Checklist**
   - [ ] Never commit API keys to version control
   - [ ] Use environment variables for all keys
   - [ ] Implement webhook signature verification
   - [ ] Use HTTPS for all endpoints
   - [ ] Enable Stripe Radar for fraud protection
   - [ ] Set up logging and monitoring

---

## Common Issues and Solutions

### Issue: "No such plan" error

**Solution**: Ensure you're using test mode keys in development

### Issue: Webhook events not received locally

**Solution**:

1. Ensure Stripe CLI is running
2. Check the webhook secret is correct
3. Verify your server is running on the expected port

### Issue: CORS errors on payment

**Solution**: Ensure publishable key is prefixed with `NEXT_PUBLIC_`

### Issue: Webhook signature verification fails

**Solution**:

1. Use the exact signing secret from CLI output
2. Don't modify the raw request body
3. Pass the raw body buffer to verification

---

## Useful Stripe CLI Commands

```bash
# Login to Stripe
stripe login

# List recent payments
stripe payments list --limit 10

# Tail webhook events in real-time
stripe logs tail

# Trigger specific webhook events
stripe trigger payment_intent.succeeded

# Forward webhooks to local endpoint
stripe listen --forward-to localhost:1235/api/v1/webhooks/stripe

# Test webhook endpoint
stripe webhooks create --url https://example.com/webhook --enabled-events payment_intent.succeeded
```

---

## Next Steps

1. **Test the Full Payment Flow**
   - Create a tab via API
   - Complete payment with test card
   - Verify webhook received and processed

2. **Review Integration**
   - Check error handling
   - Verify idempotency implementation
   - Test edge cases (timeouts, network errors)

3. **Monitor Dashboard**
   - View test payments in Dashboard
   - Check webhook delivery logs
   - Review any failed events

---

## Additional Resources

- **[Stripe Discord Community](https://discord.gg/stripe)** - Get help from other developers
- **[Stripe YouTube Channel](https://www.youtube.com/c/StripeDevelopers)** - Video tutorials
- **[Accept a Payment Guide](https://docs.stripe.com/payments/accept-a-payment)** - Step-by-step payment guide
- **[Stripe Samples on GitHub](https://github.com/stripe-samples)** - Example implementations
- **[Stripe Postman Collection](https://www.postman.com/stripedev/workspace/stripe-developers/collection/665823-fb030e00-a704-41be-84d3-60d5e84f0b20)** - API testing collection

Remember: Always use test mode for development and thoroughly test your integration before going live!
