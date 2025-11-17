# Step 1: Employee Service (Protected API)

This directory demonstrates **Step 1** of the client credentials flow: setting up the **Employee Service**, a protected API that manages employee data.

## Scenario

Imagine you have an **Employee Service** that:

- Stores and manages employee information (name, email, etc.)
- Already works with authenticated users via Supabase Auth (PKCE flow)
- Needs to be accessible by other services (like a Payroll Service) that require employee data

This example shows how to add M2M authentication to your existing Employee Service so it can accept requests from other services, background jobs, or automated scripts.

## What This Example Shows

This is a **Bun Hono server** with CRUD operations for employees data. The server is protected by JWT authentication and accepts tokens from:

1. **User JWTs** - From Supabase Auth (PKCE flow) for user-facing applications
2. **M2M Tokens** - From the `supabase-m2m onboard` command for service-to-service communication (e.g., a Payroll Service)

This allows your Employee Service to accept both user authentication and machine-to-machine authentication.

## Project Structure

```
demo/setup/
├── supabase/
│   ├── config.toml              # Supabase project configuration
│   ├── signing_key.json         # JWT signing keys (private keys - never commit!)
│   ├── migrations/
│   │   ├── YYYYMMDDHHMMSS_create_employees_table.sql  # Example table
│   │   └── YYYYMMDDHHMMSS_m2m_init.sql                # M2M migration (created by setup)
│   └── functions/
│       └── m2m-token/
│           └── index.ts        # Edge function (created by setup)
├── server.ts                    # Bun Hono server with CRUD + JWT auth
├── setup.sh                     # Automated setup script
├── generate-env.sh               # Generate .env from Supabase status
├── .env.example                 # Environment variables template
├── .env                         # Local environment variables (never commit!)
└── README.md                    # This file
```

## Quick Start

### 1. Run the Setup Script

```bash
cd demo/setup
chmod +x setup.sh
./setup.sh
```

This script will:

- ✅ Start Supabase locally
- ✅ Apply existing migrations (creates `employees` table)
- ✅ Run `supabase-m2m setup` to add M2M authentication
- ✅ Apply M2M migration
- ✅ Deploy the edge function
- ✅ Set up environment variables

### 2. Configure Environment Variables

#### For the Employee Service (server.ts)

Generate the `.env` file automatically from Supabase status using the provided script:

```bash
./generate-env.sh
```

This script extracts `SUPABASE_URL` and `SUPABASE_SECRET_KEY` from `supabase status --output env`.

Or manually create `.env` with values from `supabase status`:

- `SUPABASE_URL` - API URL (usually `http://localhost:54321`)
- `SUPABASE_SECRET_KEY` - Secret key (sb*secret*...) for database operations (bypasses RLS)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (deprecated JWT-based key, technically still works but not recommended)

**Note**: JWT verification uses JWKS from Supabase's public endpoint (`/auth/v1/.well-known/jwks.json`), so no JWT secret is needed in the Employee Service.

#### For the M2M Token Edge Function

The edge function needs a private signing key to mint tokens. Add `JWT_PRIVATE_KEY_BASE64` to your `.env` file:

1. **Extract the first key from `signing_key.json` and Base64 encode it:**

   ```bash
   # Extract first key from signing_key.json array and Base64 encode
   jq -c '.[0]' supabase/signing_key.json | base64
   ```

2. **Add the Base64 output to your `.env` file:**

   ```bash
   # Add to .env
   JWT_PRIVATE_KEY_BASE64=eyJr...your_base64_string...xyz
   ```

   The `signing_key.json` file should be in array format:

   ```json
   [
     {
       "kty": "EC",
       "kid": "...",
       "use": "sig",
       "key_ops": ["sign", "verify"],
       "alg": "ES256",
       "ext": true,
       "d": "...", // Private key component
       "crv": "P-256",
       "x": "...",
       "y": "..."
     }
   ]
   ```

3. **Run the edge function with the `.env` file:**

   ```bash
   supabase functions serve m2m-token --env-file .env
   ```

**Security Warning**: The `signing_key.json` file contains private keys. Never commit it to version control. Ensure it's in `.gitignore`.

#### Generating signing_key.json (if needed)

If `signing_key.json` doesn't exist, you can generate it manually. The file should be an array containing a JWK object with a private key:

```json
[
  {
    "kty": "EC",
    "kid": "unique-key-id",
    "use": "sig",
    "key_ops": ["sign", "verify"],
    "alg": "ES256",
    "ext": true,
    "d": "private_key_component_base64",
    "crv": "P-256",
    "x": "public_key_x_component_base64",
    "y": "public_key_y_component_base64"
  }
]
```

**Note**: Key generation will be automated by the `supabase-m2m` tool in a follow-up design. For now, you can use an existing key or generate one using cryptographic libraries.

### About API Keys

This example uses Supabase's **secret key** (`sb_secret_...`) for database operations. The older JWT-based `service_role` and `anon` keys are deprecated but technically still work.

According to the [Supabase API keys documentation](https://supabase.com/docs/guides/api/api-keys):

> `anon` and `service_role` keys are based on the project's JWT secret. They are generated when your project is created and can only be changed when you rotate the JWT secret. This can cause significant issues in production applications. Use the publishable and secret keys instead.

**Why use secret keys instead of `service_role`?**

- Secret keys can be rotated independently without affecting other keys
- Better security practices (can't be used in browsers, more granular control)
- Easier to manage and rotate in production
- No coupling to the JWT secret rotation

The `service_role` JWT-based key will still work if you need it, but we recommend using the secret key (`sb_secret_...`) for new projects. See the [full documentation](https://supabase.com/docs/guides/api/api-keys) for more details.

### 3. Seed Sample Data (Optional)

Sample employee data is automatically seeded when you run `supabase db reset`. The seed file is located at `supabase/seeds/seed_employees.sql`.

To manually seed or reseed:

```bash
# Reset database (applies migrations and seeds)
supabase db reset
```

Or manually run the seed SQL:

```bash
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/seeds/seed_employees.sql
```

### 4. Start the Protected API Server

```bash
bun run server.ts
```

The server will start on `http://localhost:3000` (or the port specified in `PORT` env var).

## Employee Service API

The `server.ts` file provides the Employee Service API with:

### Features

- ✅ **CRUD operations** for employees table
- ✅ **JWT authentication** middleware
- ✅ **Works with both**:
  - User JWTs (from Supabase Auth)
  - M2M tokens (from `supabase-m2m onboard`)
- ✅ **No RLS** - Uses secret key/service role key to bypass RLS for database operations
- ✅ **JWKS Verification** - Uses Supabase's JWKS endpoint for JWT verification (no JWT secret needed)
- ✅ **CORS enabled** for development

### API Endpoints

#### Health Check (No Auth)

```
GET /health
```

#### List Employees

```
GET /employees
Authorization: Bearer <token>
```

#### Get Employee by ID

```
GET /employees/:id
Authorization: Bearer <token>
```

#### Create Employee

```
POST /employees
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}
```

#### Update Employee

```
PUT /employees/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "jane@example.com"
}
```

#### Delete Employee

```
DELETE /employees/:id
Authorization: Bearer <token>
```

#### Get Token Info (Debug)

```
GET /auth/me
Authorization: Bearer <token>
```

### Authentication

The server accepts JWTs from two sources:

1. **User JWTs** - Generated by Supabase Auth (user sign-in via PKCE flow)
2. **M2M Tokens** - Generated by the M2M edge function (`supabase-m2m onboard`)

Both token types are verified using **JWKS** (JSON Web Key Set) from Supabase's public endpoint (`/auth/v1/.well-known/jwks.json`). This is the recommended approach as it automatically handles key rotation and doesn't require managing JWT secrets in your service.

**Note**: The `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) is only used for the Supabase client to bypass RLS when making database queries - it's not used for JWT verification.

## Testing the Employee Service

### Using a User JWT (Existing Functionality)

The Employee Service already works with user authentication. Generate a user JWT:

```bash
supabase gen bearer-jwt --user-id <uuid>
```

Test the API:

```bash
TOKEN="your-jwt-token"
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/employees
```

### Using an M2M Token (New Functionality)

After completing **Step 2** (onboarding the Payroll Service), you can test with M2M tokens:

1. Register the Payroll Service (see `demo/onboard/README.md`):

```bash
supabase-m2m onboard
```

2. The Payroll Service will automatically get tokens and call this Employee Service (see examples in `demo/onboard/`):

```bash
# The Payroll Service example will automatically call this Employee Service
export CLIENT_ID="payroll-service"
export CLIENT_SECRET="your-client-secret"
export API_URL="http://localhost:3000"
bun demo/onboard/payroll-service.ts
```

## Verify Setup

Check that everything is running:

```bash
supabase status
```

You should see:

- API URL: `http://localhost:54321`
- Studio URL: `http://localhost:54323`
- Database running on port `54322`

## View in Studio

Open Supabase Studio in your browser:

```
http://localhost:54323
```

You should see:

- `employees` table (empty, ready for your data - or seeded if you ran `bun run seed`)
- `machine_secrets` table (empty, ready for services)

## Manual Setup (Alternative)

If you prefer to set up manually:

### 1. Start Supabase

```bash
cd demo/setup
supabase start
```

### 2. Get Environment Variables

```bash
# Simple extraction using env output format
export SUPABASE_URL=$(supabase status --output env | grep "^API_URL=" | cut -d'=' -f2 | tr -d '"')
export SUPABASE_SECRET_KEY=$(supabase status --output env | grep "^SECRET_KEY=" | cut -d'=' -f2 | tr -d '"')

# Or use the automated script
./generate-env.sh
```

Note: Uses `SECRET_KEY` (sb*secret*...) - the modern API key format. The deprecated `SERVICE_ROLE_KEY` JWT-based key is no longer recommended. See [Supabase API keys documentation](https://supabase.com/docs/guides/api/api-keys) for details.

### 3. Run M2M Setup

```bash
supabase-m2m setup
```

Follow the prompts:

- **Token expiration**: `15` (minutes, default)

### 4. Apply Migration

```bash
supabase migration up
```

### 5. Deploy Edge Function

```bash
supabase functions deploy m2m-token --no-verify-jwt
```

### 6. Set Edge Function Secrets

**Option 1: Use the automated script (recommended)**

```bash
./set-edge-secrets.sh
```

**Option 2: Set manually**

```bash
JWT_SECRET=$(supabase status | grep "JWT secret" | awk '{print $3}')
supabase secrets set JWT_SECRET="$JWT_SECRET"
supabase secrets set SUPABASE_URL="http://localhost:54321"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
supabase secrets set M2M_TOKEN_EXPIRY_SECONDS="900"
```

## What's Included

### Existing Tables

**employees** - Example table:

- `id` (bigint, auto-increment)
- `name` (text, required)
- `email` (text)
- `created_at` (timestamp)

### M2M Authentication

**machine_secrets** - Table for service credentials:

- `client_id` (text, primary key)
- `client_secret_hash` (text, bcrypt)
- `scopes` (text array)
- `is_active` (boolean)
- `created_at`, `updated_at` (timestamps)

**m2m-token** - Edge function for token exchange:

- Endpoint: `http://localhost:54321/functions/v1/m2m-token`
- Method: `POST`
- Body: `{ "client_id": "...", "client_secret": "..." }`
- Returns: JWT access token (signed with asymmetric key from `signing_key.json`)

**signing_key.json** - JWT signing keys for token minting:

- Location: `supabase/signing_key.json`
- Format: Array of JWK objects `[{...key object...}]`
- Contains: Private keys (including "d" field for EC keys)
- Used by: Supabase Auth (reads public keys for JWKS) and edge function (uses private key for signing)
- Security: Never commit to version control (should be in `.gitignore`)

## Next Steps

After completing this setup:

1. **Go to Step 2**: See `demo/onboard/README.md` to onboard the Payroll Service that will access this Employee Service
2. **Test Integration**: The Payroll Service example in `demo/onboard/` will automatically call this Employee Service once you've onboarded it

## Useful Commands

```bash
# View Supabase status
supabase status

# Seed sample data
bun run seed

# Seed with force (clears existing data)
bun run seed.ts --force

# View database tables
supabase db diff

# View edge functions
supabase functions list

# Reset database (reapplies all migrations)
supabase db reset

# Stop Supabase
supabase stop

# View logs
supabase functions logs m2m-token
```

## Environment Variables

The setup script automatically extracts these from `supabase status --output env`:

- `SUPABASE_URL` - API endpoint (default: `http://localhost:54321`)
- `SUPABASE_SECRET_KEY` - Secret key (sb*secret*...) for database operations (bypasses RLS)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (deprecated JWT-based key, technically still works but not recommended)

**JWT Verification**: The Employee Service uses JWKS from Supabase's public endpoint (`/auth/v1/.well-known/jwks.json`), so no JWT secret is needed in the service itself.

**Edge Function**: The M2M token edge function needs a private signing key to mint tokens. For local development, use `.env` file with `--env-file` flag:

1. **Add to `.env` file:**

   - `SUPABASE_URL` - API endpoint (from `supabase status`)
   - `SUPABASE_SECRET_KEY` - Secret key (from `supabase status`)
   - `JWT_PRIVATE_KEY_BASE64` - Base64-encoded private key from `signing_key.json[0]`
     ```bash
     # Extract and encode the key
     jq -c '.[0]' supabase/signing_key.json | base64
     # Add to .env: JWT_PRIVATE_KEY_BASE64=<base64_output>
     ```

2. **Run the edge function:**
   ```bash
   supabase functions serve m2m-token --env-file .env
   ```

**Note**: For production, you would set these as edge function secrets. For local development, using `.env` with `--env-file` is the recommended approach.

**About API Keys**: This example uses Supabase's **secret key** (`sb_secret_...`) instead of the deprecated JWT-based `service_role` key. According to the [Supabase API keys documentation](https://supabase.com/docs/guides/api/api-keys):

> `anon` and `service_role` keys are based on the project's JWT secret. They are generated when your project is created and can only be changed when you rotate the JWT secret. This can cause significant issues in production applications. Use the publishable and secret keys instead.

The `service_role` JWT-based key will technically still work, but we recommend using the secret key for better security and easier rotation. See the [full documentation](https://supabase.com/docs/guides/api/api-keys) for more details.

## Troubleshooting

### Port Already in Use

If ports are already in use:

```bash
supabase stop
# Then run setup.sh again
```

### Migration Already Applied

If you see "migration already applied" errors:

```bash
supabase db reset  # Resets and reapplies all migrations
```

### Edge Function Not Deploying

Check that Supabase is running:

```bash
supabase status
```

Then deploy manually:

```bash
supabase functions deploy m2m-token --no-verify-jwt
```

### JWT Signing Key Not Available

If the edge function fails with "JWT signing key not available":

1. **Check `signing_key.json` exists**: Ensure the file is in `supabase/signing_key.json`
2. **Verify format**: Should be an array with at least one key object
3. **Check `.env` file**: Ensure `JWT_PRIVATE_KEY_BASE64` is set:
   ```bash
   # Extract and encode
   jq -c '.[0]' supabase/signing_key.json | base64
   # Add to .env
   echo "JWT_PRIVATE_KEY_BASE64=<base64_output>" >> .env
   ```
4. **Verify `--env-file` flag**: Run edge function with:
   ```bash
   supabase functions serve m2m-token --env-file .env
   ```

### JWT Verification Failing

The Employee Service uses JWKS for JWT verification, so no JWT secret is needed. If verification is failing:

1. **Check Supabase is running**: The JWKS endpoint must be accessible

   ```bash
   curl http://localhost:54321/auth/v1/.well-known/jwks.json
   ```

2. **Verify SUPABASE_URL is correct**: Ensure it matches your Supabase instance

   ```bash
   supabase status
   ```

3. **Check token format**: Ensure tokens are valid JWTs from Supabase Auth or the M2M edge function

**Note**: Token verification/decoding will be handled in a follow-up design.

## Reference

- [Supabase CLI Docs](https://supabase.com/docs/reference/cli)
- [Database Migrations Guide](https://supabase.com/docs/guides/deployment/database-migrations)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Hono Documentation](https://hono.dev)
