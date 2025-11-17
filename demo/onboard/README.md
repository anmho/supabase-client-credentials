# Step 2: Payroll Service (Client Service)

This folder demonstrates **Step 2** of the client credentials flow: onboarding the **Payroll Service**, a client service that needs to access the **Employee Service** (set up in `demo/setup`).

## Scenario

Imagine you have a **Payroll Service** that:

- Runs as a background service or scheduled job
- Needs to fetch employee data from the Employee Service to process payroll
- Cannot use user authentication (no user is logged in)
- Needs secure, automated access to the Employee Service API

This step shows how to register the Payroll Service and give it credentials to authenticate with the Employee Service using M2M client credentials flow.

## Prerequisites

1. ✅ **Step 1 Complete**: You have completed `demo/setup` first

   - Supabase is running locally
   - The `machine_secrets` table exists
   - The `m2m-token` edge function is deployed
   - The Employee Service API is running (see `demo/setup/README.md`)

2. Environment variables are set for the `supabase-m2m onboard` command (see Usage section)

## Overview

This step shows how to:

- Register the Payroll Service using `supabase-m2m onboard`
- Get M2M tokens for the Payroll Service
- Use those tokens to access the Employee Service API from `demo/setup`

## Environment Variables

### For the `supabase-m2m onboard` command

The `onboard` command needs these environment variables (set in `demo/setup` directory):

- `SUPABASE_URL` - Your Supabase project URL (usually `http://localhost:54321`)
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` - For database access

These are typically set via the `.env` file in `demo/setup` (see `demo/setup/README.md`).

### For the Payroll Service (`payroll-service.ts`)

The Payroll Service needs these environment variables:

- `CLIENT_ID` - The randomly generated client ID from `supabase-m2m onboard`
- `CLIENT_SECRET` - The client secret from `supabase-m2m onboard`
- `SUPABASE_URL` - Your Supabase project URL (default: `http://localhost:54321`)
  - Used to derive `M2M_TOKEN_URL` as `${SUPABASE_URL}/functions/v1/m2m-token`
- `API_URL` - Employee Service URL (default: `http://localhost:3000`)
- `PORT` - Server port (default: `4000`)

**Quick setup**: Copy `.env.example` to `.env` and fill in your `CLIENT_ID` and `CLIENT_SECRET` from the `supabase-m2m onboard` command output.

## Usage

### Option 1: Run directly

1. Navigate to your Supabase project root:

   ```bash
   cd demo/setup  # The Supabase project is in demo/setup
   ```

2. Run the onboard command:

   ```bash
   supabase-m2m onboard
   ```

3. Follow the interactive prompts:

   - **Scopes**: Enter comma-separated scopes (e.g., `employees:read`)

   The `CLIENT_ID` and `CLIENT_SECRET` are automatically generated and displayed.

### Option 2: Use the example script

```bash
# From demo/setup directory (the Supabase project root)
cd demo/setup
../onboard/example.sh
```

The example script will:

- Verify environment variables are set
- Run the onboard command
- Display next steps

## What It Does

- ✅ Generates a secure random `CLIENT_ID` (16 bytes, ~22 chars)
- ✅ Generates a secure random `CLIENT_SECRET` (32 bytes, ~43 chars)
- ✅ Hashes the secret using bcrypt (Golang compatible)
- ✅ Stores credentials in the `machine_secrets` table
- ✅ Displays credentials for you to save securely

## Important Security Notes

⚠️ **Save both CLIENT_ID and CLIENT_SECRET immediately** - the CLIENT_SECRET cannot be retrieved again!

Store credentials securely:

- Use environment variables in your service
- Never commit secrets to version control
- Use a secrets manager for production

## Example Output

```
📝 Registering a new service for M2M authentication
✓ Enter service details...
? Enter required scopes (comma-separated, e.g., employees:read): employees:read
✓ Client 'abc123xyz789...' registered successfully!

┃ IMPORTANT
┃
┃ -- SECURE CLIENT CREDENTIALS --
┃ CLIENT_ID:      abc123xyz789...
┃ CLIENT_SECRET:  def456uvw012...
┃
┃ Both credentials are randomly generated and cryptographically secure.
┃ Store them securely in your service's environment variables.
┃ You will not be able to retrieve the CLIENT_SECRET again.
✅ Service registered! Your service can now use these credentials.
```

## Using the Credentials

After registration, the Payroll Service can use these credentials to access the Employee Service API from `demo/setup`.

### Environment Variables for Payroll Service

```bash
export CLIENT_ID="abc123xyz789..."  # Randomly generated
export CLIENT_SECRET="def456uvw012..."  # Randomly generated
export SUPABASE_URL="http://localhost:54321"  # Optional, has default (used to derive M2M_TOKEN_URL)
export API_URL="http://localhost:3000"  # Optional, has default (Employee Service)
export PORT="4000"  # Optional, has default
```

### Example: Test the Token Endpoint

#### Using the test script:

```bash
CLIENT_ID=abc123xyz789... \
CLIENT_SECRET=def456uvw012... \
./demo/onboard/test-token.sh
```

#### Using curl directly:

```bash
curl -X POST http://localhost:54321/functions/v1/m2m-token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "abc123xyz789...",
    "client_secret": "def456uvw012..."
  }'
```

### Example: Run the Payroll Service

**Important**: Make sure the Employee Service from `demo/setup` is running first!

```bash
# Terminal 1: Start the Employee Service (in demo/setup)
cd demo/setup
bun run server.ts

# Terminal 2: Start the Payroll Service
export CLIENT_ID="abc123xyz789..."  # Use the generated CLIENT_ID
export CLIENT_SECRET="def456uvw012..."  # Use the generated CLIENT_SECRET
export SUPABASE_URL="http://localhost:54321"  # Optional, M2M_TOKEN_URL derived from this
export API_URL="http://localhost:3000"  # Optional, has default
bun demo/onboard/payroll-service.ts
```

The Payroll Service will:

1. Start on `http://localhost:4000` (or the port specified in `PORT` env var)
2. Automatically get and refresh M2M tokens before expiration
3. Expose endpoints that use tokens to call the Employee Service API

### Using the Payroll Service

Once the Payroll Service is running, you can curl it periodically to demonstrate token refresh:

```bash
# Get employees ready for payroll processing
curl http://localhost:4000/payroll/ready

# Get employee email by ID (replace {id} with actual employee ID)
curl http://localhost:4000/employees/{id}/email

# Send payroll email to employee (replace {id} with actual employee ID)
curl -X POST http://localhost:4000/employees/{id}/send-payroll

# Check token info (for debugging)
curl http://localhost:4000/token-info

# Health check
curl http://localhost:4000/health
```

**Try it over time**: The Payroll Service automatically refreshes tokens, so you can curl these endpoints repeatedly and they'll continue to work even as tokens expire and are refreshed. This demonstrates how a background service can continuously access the Employee Service.

## Complete Workflow

1. **Step 1**: Set up the Employee Service

   ```bash
   cd demo/setup
   ./setup.sh
   bun run server.ts  # Keep this running
   ```

2. **Step 2**: Onboard the Payroll Service (this step)

   ```bash
   cd demo/setup
   supabase-m2m onboard
   # When prompted, enter scopes (e.g., employees:read)
   # Save the randomly generated CLIENT_ID and CLIENT_SECRET
   ```

3. **Test**: Start the Payroll Service and curl it

   ```bash
   # Start the Payroll Service
   export CLIENT_ID="abc123xyz789..."  # Use the generated CLIENT_ID
   export CLIENT_SECRET="your-client-secret"
   export API_URL="http://localhost:3000"
   bun demo/onboard/payroll-service.ts

   # In another terminal, curl the endpoints
   curl http://localhost:4000/payroll/ready  # Get employees ready for payroll
   curl http://localhost:4000/employees/{id}/email  # Get employee email
   curl -X POST http://localhost:4000/employees/{id}/send-payroll  # Send payroll email

   # Try again after a few minutes to see token refresh in action
   curl http://localhost:4000/payroll/ready
   ```

## What the Example Does

The `payroll-service.ts` file is the **Payroll Service** - a background service that uses M2M credentials to access the Employee Service API. It demonstrates the complete client credentials flow:

1. **Token Management**: Automatically gets and refreshes M2M tokens before expiration
2. **Employee Service Access**: Exposes endpoints that use tokens to call the Employee Service API (from `demo/setup` running on `localhost:3000`)
3. **Long-Running Service**: Runs continuously, showing that token refresh works over time

**Prerequisites:**

- Employee Service running (`demo/setup/server.ts`)
- Payroll Service onboarded (`supabase-m2m onboard`)
- Environment variables: `CLIENT_ID`, `CLIENT_SECRET`, `API_URL`

### Payroll Service Endpoints

- **`GET /health`** - Health check endpoint
- **`GET /payroll/ready`** - Gets list of employees ready for payroll processing (those with email addresses)
- **`GET /employees/:id/email`** - Gets an employee's email address by ID (needed for sending payroll notifications)
- **`POST /employees/:id/send-payroll`** - Sends a payroll notification email to an employee
- **`GET /token-info`** - View current token information (for debugging)

### Token Refresh

The Payroll Service automatically refreshes tokens:

- On startup: Gets initial token
- Before expiration: Refreshes 5 minutes before token expires
- On demand: Refreshes if token is expired when an endpoint is called

This demonstrates how a background service (like a payroll processor, scheduled job, or microservice) can authenticate and access the Employee Service API over long periods of time without user interaction.

## Troubleshooting

### "Connection refused" when calling API

Make sure the Employee Service from `demo/setup` is running:

```bash
cd demo/setup
bun run server.ts
```

### "Invalid or expired token"

- Check that you're using the correct `CLIENT_ID` and `CLIENT_SECRET`
- Verify the `m2m-token` edge function is deployed: `supabase functions list`
- Check edge function logs: `supabase functions logs m2m-token`

### "Missing or invalid Authorization header"

Make sure you're setting the `Authorization` header correctly:

```
Authorization: Bearer <your-token>
```
