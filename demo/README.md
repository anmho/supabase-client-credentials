# Demo Usage Examples

This folder contains demo examples for the client credentials flow with `supabase-m2m`.

## Scenario

This demo demonstrates a realistic scenario with two services:

- **Employee Service** (`demo/setup`) - A protected API that manages employee data
  - Already works with authenticated users via Supabase Auth (PKCE flow)
  - Needs to be accessible by other services for automated access
- **Payroll Service** (`demo/onboard`) - A background service that needs employee data
  - Runs as a scheduled job or background service
  - Needs to fetch employee data from the Employee Service to process payroll
  - Cannot use user authentication (no user is logged in)
  - Uses M2M client credentials to authenticate with the Employee Service

## Overview

The demo is split into two steps that work together:

1. **`demo/setup`** - Step 1: Setting up the **Employee Service** (protected API) that requires M2M authentication
2. **`demo/onboard`** - Step 2: Onboarding the **Payroll Service** (client service) that will access the Employee Service

## Structure

```
demo/
├── setup/                    # Step 1: Protected service setup
│   ├── README.md            # Setup documentation
│   ├── server.ts           # Protected API server (Bun Hono)
│   ├── setup.sh              # Automated setup script
│   └── supabase/             # Supabase project configuration
│       ├── config.toml
│       ├── migrations/
│       └── functions/
│           └── m2m-token/    # Edge function for token exchange
└── onboard/                  # Step 2: Client service onboarding
    ├── README.md            # Onboard documentation
    ├── example.sh           # Example onboard script
    ├── payroll-service.ts   # Payroll Service (TypeScript/Bun)
    └── test-token.sh        # Quick token test script
```

## Quick Start

### Step 1: Set Up Employee Service

Set up the Employee Service that will be protected by M2M authentication:

```bash
cd demo/setup
./setup.sh
bun run server.ts  # Keep this running
```

This will:

- Start Supabase locally
- Set up M2M authentication infrastructure
- Start the Employee Service API on `http://localhost:3000`

See [setup/README.md](./setup/README.md) for detailed instructions.

### Step 2: Onboard Payroll Service

Onboard the Payroll Service that will access the Employee Service:

```bash
# From demo/setup directory (Supabase project root)
cd demo/setup
supabase-m2m onboard
```

When prompted, use `CLIENT_ID: payroll-service`. **Save the CLIENT_SECRET immediately!**

See [onboard/README.md](./onboard/README.md) for detailed instructions.

### Step 3: Test the Integration

Start the Payroll Service and curl it:

```bash
# Terminal 1: Start the Employee Service (if not already running)
cd demo/setup
bun run server.ts

# Terminal 2: Start the Payroll Service
export CLIENT_ID="payroll-service"
export CLIENT_SECRET="your-client-secret"
export API_URL="http://localhost:3000"
bun demo/onboard/payroll-service.ts

# Terminal 3: Curl the Payroll Service endpoints
curl http://localhost:4000/payroll/ready  # Get employees ready for payroll processing
curl http://localhost:4000/employees/{employee-id}/email  # Get employee email
curl -X POST http://localhost:4000/employees/{employee-id}/send-payroll  # Send payroll email

# Try again after a few minutes to see token refresh in action
curl http://localhost:4000/payroll/ready
```

The Payroll Service will:

1. Start a server on `http://localhost:4000`
2. Automatically get and refresh M2M tokens before expiration
3. Expose endpoints that use tokens to call the Employee Service API
4. Continue working over time as tokens are automatically refreshed

## How It Works

```
┌─────────────────┐
│ Payroll Service │  (Step 2: demo/onboard)
│                 │
│  - Gets token   │
│  - Calls API    │
└────────┬────────┘
         │
         │ 1. Request token
         ▼
┌─────────────────┐
│  M2M Edge Func  │
│  /m2m-token     │
└────────┬────────┘
         │
         │ 2. Verify credentials
         ▼
┌─────────────────┐
│  Supabase DB    │
│  machine_secrets│
└─────────────────┘
         │
         │ 3. Return JWT token
         ▼
┌─────────────────┐
│ Payroll Service │
└────────┬────────┘
         │
         │ 4. Use token to call API
         ▼
┌─────────────────┐
│Employee Service │  (Step 1: demo/setup)
│ localhost:3000  │
│                 │
│  - Verifies JWT │
│  - Returns data │
└─────────────────┘
```

## Commands Overview

| Step | Command                | Purpose                   | When to Use                            |
| ---- | ---------------------- | ------------------------- | -------------------------------------- |
| 1    | `supabase-m2m setup`   | Set up M2M infrastructure | Once per Supabase project              |
| 2    | `supabase-m2m onboard` | Register a client service | Each time you need to add a new client |

## Environment Variables

### For Setup (Step 1)

- `SUPABASE_URL` - Your Supabase project URL
- `SERVICE_ROLE_KEY` - Your Supabase service role key

### For Onboard (Step 2)

- `SUPABASE_URL` - Your Supabase project URL
- `SERVICE_ROLE_KEY` - Your Supabase service role key

### For Client Examples

- `CLIENT_ID` - The client ID from `supabase-m2m onboard`
- `CLIENT_SECRET` - The client secret from `supabase-m2m onboard`
- `SUPABASE_URL` - Your Supabase project URL (default: `http://localhost:54321`)
  - Used to derive `M2M_TOKEN_URL` as `${SUPABASE_URL}/functions/v1/m2m-token`
- `API_URL` - Protected API server URL (default: `http://localhost:3000`)

## Example Files

### TypeScript/Bun

- **`onboard/payroll-service.ts`**: Payroll Service server that demonstrates:
  - Automatic M2M token management with refresh
  - Long-running server that accesses the Employee Service API
  - Multiple endpoints you can curl to test the integration (sync employee data, get statistics)
  - Token refresh working over time (curl repeatedly to see it in action)

## Next Steps

After completing both steps:

1. **Use in your own services**: Copy the patterns from the examples
2. **Implement scope-based authorization**: Check token scopes in your protected APIs
3. **Deploy to production**: Link to remote project with `supabase link` and `supabase db push`

## Troubleshooting

### Employee Service not responding

Make sure Step 1 is complete and the Employee Service is running:

```bash
cd demo/setup
bun run server.ts
```

### Token request failing

- Verify credentials are correct
- Check that `supabase-m2m setup` was completed
- Verify edge function is deployed: `supabase functions list`
- Check logs: `supabase functions logs m2m-token`

### API calls failing with 401

- Verify the token is being sent in the `Authorization` header
- Check that Supabase is running and the JWKS endpoint is accessible (`/auth/v1/.well-known/jwks.json`)
- Verify the token hasn't expired

## Reference

- [Setup Documentation](./setup/README.md) - Detailed setup instructions
- [Onboard Documentation](./onboard/README.md) - Detailed onboarding instructions
