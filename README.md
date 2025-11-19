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

Run the install script:

```bash
./install.sh
```

Or use the npm script:

```bash
bun run install:global
```

This will:

- Install all dependencies
- Link `supabase-m2m` as a global command
- Display usage instructions

**Note**: If you encounter an error about a missing package.json in your home directory, ensure you're running the command from the project root directory.

## Demo Setup From Scratch

The `demo/setup/supabase/config.toml` configuration expects a local signing key at `./signing_key.json`. To reproduce the full demo from a clean Supabase project:

1. **Initialize Supabase locally**

   ```bash
   cd demo/setup
   supabase init
   ```

2. **Generate the signing key referenced by `config.toml`**

   `supabase gen signing-key` prints a single ES256 JWK such as `{"kty":"EC","kid":"652d13cf-59f0-4214-bee7-3acb6472b461","use":"sig",...}` to `stdout` while instructions (e.g., “wrap the key in []”) go to `stderr`. Supabase expects an array of keys, so wrap the JSON object in square brackets before saving:

   ```bash
   supabase gen signing-key | jq -s '.' > supabase/signing_key.json
   ```

   ```toml
   [auth]
   signing_keys_path = "./signing_key.json"
   ```

3. **Start the local stack**

   ```bash
   supabase start
   ```

4. **Create test JWTs for your flows**

   ```bash
   # Generate an authenticated-user token (replace with a valid UUID)
   supabase gen bearer-jwt --role authenticated --user-id <user_id>

   # Generate a service-role token
   supabase gen bearer-jwt --role service_role
   ```

5. **Run the Bun demo server**

   ```bash
   bun install
   bun run server.ts
   ```

These steps align the demo environment with the repository defaults and ensure the Supabase CLI outputs (signing key and bearer JWTs) match the expectations baked into `config.toml`.

## Usage

### Setup Command

1. Navigate to your Supabase project root (where `supabase/` directory exists)

2. Run the setup command:

   ```bash
   supabase-m2m setup
   ```

3. Follow the interactive prompts:

   - Token expiration time in minutes (default: `15`)

This will:

- Create and apply the migration
- Create and deploy the edge function
- Set required secrets automatically

### Onboard Command

1. Navigate to your Supabase project root

2. Run the onboard command:

   ```bash
   supabase-m2m onboard
   ```

3. Follow the interactive prompts:

   - Supabase URL (default: `http://localhost:54321`)
   - Secret Key (`sb_secret_...`) - use password prompt
   - Enter required scopes (comma-separated, e.g., `api:read,jobs:write`)

   The `CLIENT_ID` and `CLIENT_SECRET` are automatically generated and displayed.

4. **Save the credentials** shown in the output - the `CLIENT_SECRET` cannot be retrieved later!

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
   - Generates secure random `CLIENT_ID` (16 bytes, ~22 chars, base64url)
   - Generates secure random `CLIENT_SECRET` (32 bytes, ~43 chars, base64url)
   - Hashes secret with bcrypt (cost: 10)
   - Stores credentials in `machine_secrets` table

## Template Files

The utility includes template files in `template/`:

- **`migration.sql`** - Database schema for machine secrets
- **`edge-function.ts`** - Deno edge function for token exchange
- **`demo/onboard/go-refresh.go`** - Golang client example with auto-refresh

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

## Understanding JWT Authentication in Supabase

### Service Role JWTs

**Service Role JWTs** are tokens associated with the `service_role` key, which has elevated privileges in your Supabase project. These tokens:

- **Bypass Row Level Security (RLS)**: Service role tokens have full access to your database, ignoring all RLS policies
- **Use for server-side operations**: Ideal for administrative tasks, migrations, and background jobs
- **Never expose to clients**: The `service_role` key should only be used in secure server environments

**⚠️ Security Warning**: Never expose your `service_role` key or service role JWTs to client-side code. They grant full database access.

### Generating Bearer JWTs with Supabase CLI

You can generate JWTs for testing using the Supabase CLI:

```bash
# Generate a service role JWT
supabase gen bearer-jwt --role service_role

# Generate a JWT for a specific user
supabase gen bearer-jwt --user-id <uuid>
```

The `supabase gen bearer-jwt` command is useful for:

- **Testing**: Generate tokens for local development and API testing
- **Debugging**: Verify JWT claims and token structure
- **Development**: Create tokens with specific roles or user IDs

### M2M Tokens vs Service Role JWTs

| Aspect       | M2M Tokens (this tool)                | Service Role JWTs           |
| ------------ | ------------------------------------- | --------------------------- |
| **Purpose**  | Service-to-service authentication     | Administrative operations   |
| **RLS**      | Respects RLS policies                 | Bypasses RLS                |
| **Scopes**   | Custom scopes for fine-grained access | Full database access        |
| **Use Case** | Microservices, background jobs        | Migrations, admin scripts   |
| **Security** | Scoped permissions                    | Full access (use carefully) |

M2M tokens generated by this tool are designed for service-to-service communication with **scoped permissions**, while service role JWTs provide **unrestricted access** for administrative purposes.

## Using the Golang Client

See `demo/onboard/go-refresh.go` for a production-ready Golang client with:

- Thread-safe token management
- Automatic token refresh (5 minutes before expiration)
- Standard library only (`net/http`)

## License

Private - for personal use
