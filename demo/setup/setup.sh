#!/bin/bash
# Example: Running supabase-m2m setup

# LOCAL SETUP for (service protected by client credentials bearer token)
# 1. Generate migrations for machine_secrets
# 2. Apply migrations for machine_secrets
# 3. Generate new signing key (if not exists) - manual or via script
# 4. Add signing key to signing_key.json (array format with JWK object containing private key)
# 5. Add signing key path to config.toml: signing_keys_path = "./signing_key.json"
# 6. Extract first key from signing_key.json and Base64 encode for .env:
#    jq -c '.[0]' supabase/signing_key.json | base64
#    Add to .env: JWT_PRIVATE_KEY_BASE64=<base64_output>
# 7. Create m2m-tokens edge function
# 8. Run edge function with: supabase functions serve m2m-token --env-file .env
# Can now generate authenticated bearer tokens using supabase gen bearer-jwt --role authenticated --user-id <user_id> etc
# Can now generate m2m bearer tokens using supabase-m2m gen m2m-token (which will call the local edge function)

# PROD SETUP (manual, wizard cannot do these due to supabase cli limitations)
# Rotate signing key with generated signing key
# Upload edge function environment variables to supabase
# Deploy edge function


supabase-m2m setup



