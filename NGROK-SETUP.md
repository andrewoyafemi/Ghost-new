# Ngrok Webhook Setup for Development

This project includes built-in ngrok integration for testing webhooks in development environments.

## What is Ngrok?

[Ngrok](https://ngrok.com/) creates secure tunnels to expose your local development server to the internet, allowing external services like Stripe to send webhooks to your local machine.

## Setup Instructions

1. **Get an Ngrok Auth Token**:

   - Sign up for a free account at [ngrok.com](https://ngrok.com/signup)
   - Get your auth token from the ngrok dashboard

2. **Configure Your .env File**:

   ```
   # Add these to your .env file
   ENABLE_NGROK=true
   NGROK_AUTH_TOKEN=your-ngrok-auth-token
   ```

3. **Run Your Server**:

   ```bash
   npm run dev
   ```

   When the server starts, you'll see the ngrok URL in the console logs:

   ```
   -------------------------------------------------------------------------
   🌐 Your Stripe webhook URL for development:
   https://abc123.ngrok.io/api/v1/stripe/webhook
   -------------------------------------------------------------------------
   ```

4. **Configure Stripe Webhook**:
   - Go to [Stripe Dashboard > Developers > Webhooks](https://dashboard.stripe.com/test/webhooks)
   - Add an endpoint using the URL displayed in your console
   - Select these events to listen for:
     - `checkout.session.completed`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`

## Disabling Ngrok

### Temporary Disable

To temporarily disable ngrok without removing it:

```
# In your .env file
ENABLE_NGROK=false
```

### Production Environments

Ngrok is automatically disabled in production environments. The system checks:

1. If `NODE_ENV` is set to anything other than "development"
2. If `ENABLE_NGROK` is set to "false"

## Removing Ngrok Integration

If you want to completely remove the ngrok integration:

1. Remove the ngrok dependency:

   ```bash
   npm uninstall ngrok
   ```

2. Delete the helper file:

   ```bash
   rm src/utils/ngrok-helper.ts
   ```

3. Remove ngrok-related code from `server.ts`:
   - Remove the import: `import { startNgrokTunnel } from "./utils/ngrok-helper";`
   - Remove the ngrok startup block (the if statement that checks for `process.env.NODE_ENV === 'development'`)

## Troubleshooting

- **Error: ngrok not connected**: Make sure your auth token is correct and that you have an internet connection.
- **Limited connections**: Free ngrok accounts have limited connections. If you're experiencing issues, check your [ngrok dashboard](https://dashboard.ngrok.com/tunnels) for active tunnels.

- **Invalid auth**: Ensure you've properly configured your NGROK_AUTH_TOKEN in the .env file.

## Security Notes

- Never use ngrok in production environments
- Your local server is exposed to the internet while ngrok is running
- Auth tokens should be kept private and not committed to version control
