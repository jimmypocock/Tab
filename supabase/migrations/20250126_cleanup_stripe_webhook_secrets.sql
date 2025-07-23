-- Clean up webhook_secret for Stripe processors
-- Since Stripe uses a shared webhook secret from environment variables,
-- we don't need to store it per merchant

-- Update all Stripe processors to have null webhook_secret
UPDATE merchant_processors
SET webhook_secret = NULL
WHERE processor_type = 'stripe';

-- Add a comment to clarify the field usage
COMMENT ON COLUMN merchant_processors.webhook_secret IS 'Webhook signature secret for processors that use per-merchant webhooks (e.g., Square, PayPal). Stripe uses shared secret from environment variable.';