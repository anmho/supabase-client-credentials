# sb-m2m-cli

A CLI utility for setting up Supabase Machine-to-Machine (M2M) authentication using the OAuth 2.0 Client Credentials flow. This tool automates the creation of database migrations, edge functions, and client credential registration for secure service-to-service authentication.

## Features

- 🔐 **Bcrypt hashing** for cross-language compatibility (Bun, Deno, Golang)
- 🚀 **Automated setup** of migrations and edge functions
- 🎯 **Interactive CLI** with `@clack/prompts`
- 🔑 **Secure credential generation** and registration
- 📦 **Template-based** architecture for easy customization

## Prerequisites

- [Bun](https://bun.sh) installed
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed
- An existing Supabase project (local or remote)

## Installation

```bash
bun install
```

## Setup

Set the required environment variables:

### For Local Supabase Development

```bash
export SUPABASE_URL="http://localhost:54321"
export SERVICE_ROLE_KEY="your-service-role-key"
```

Get your local service role key:
```bash
supabase status
```

### For Remote Supabase Project

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SERVICE_ROLE_KEY="your-service-role-key"
```

Get your remote service role key from: **Settings → API → service_role key**

## Usage

1. Navigate to your Supabase project root (where `supabase/` directory exists)

2. Run the CLI:
   ```bash
   bun onboard.ts
   ```

3. Follow the interactive prompts:
   - Confirm you're in the Supabase project root
   - Enter a unique `CLIENT_ID` (e.g., `notification-service`)
   - Enter required scopes (comma-separated, e.g., `api:read,jobs:write`)

4. **Save the credentials** shown in the output - the `CLIENT_SECRET` cannot be retrieved later!

5. Apply the migration (if Supabase is already running):
   ```bash
   supabase db reset
   ```

## What It Does

The CLI performs the following operations:

1. **Creates database migration** (`supabase/migrations/`)
   - Sets up `machine_secrets` table with bcrypt hashing
   - Configures Row Level Security policies
   - Adds indexes and triggers

2. **Deploys edge function** (`supabase/functions/m2m-token/`)
   - Implements OAuth 2.0 Client Credentials flow
   - Verifies credentials using bcrypt
   - Generates JWT tokens with custom claims (`role: 'service'`, `scopes`)

3. **Registers client credentials**
   - Generates secure `CLIENT_ID` and `CLIENT_SECRET`
   - Hashes secret with bcrypt (cost: 10)
   - Stores credentials in `machine_secrets` table

## Template Files

The utility includes template files in `template/`:

- **`migration.sql`** - Database schema for machine secrets
- **`edge-function.ts`** - Deno edge function for token exchange
- **`go-refresh.go`** - Golang client example with auto-refresh

## Testing the Token Endpoint

After setup, test the edge function:

```bash
curl -X POST http://localhost:54321/functions/v1/m2m-token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "your-client-id",
    "client_secret": "your-client-secret"
  }'
```

Expected response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "api:read jobs:write"
}
```

## JWT Token Claims

The generated tokens include:

- `sub`: Client ID
- `role`: `'service'` (for RLS policies)
- `scopes`: Array of authorized scopes
- `iss`: Supabase project URL
- `exp`: Expiration (1 hour)
- `iat`: Issued at timestamp

## Using the Golang Client

See `template/go-refresh.go` for a production-ready Golang client with:
- Thread-safe token management
- Automatic token refresh (5 minutes before expiration)
- Standard library only (`net/http`)

## License

Private - for personal use
