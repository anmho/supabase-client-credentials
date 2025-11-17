// Supabase Edge Function: m2m-token
// OAuth 2.0 Client Credentials flow for machine-to-machine authentication

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import { SignJWT, importJWK } from 'jose';
import { z } from 'zod';

const functionName = 'm2m-token';
const app = new Hono().basePath(`/${functionName}`);

interface MachineSecret {
  client_id: string;
  client_secret_hash: string;
  scopes: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Environment variable validation
const envSchema = z.object({
  API_URL: z.string().url(),
  SECRET_KEY: z.string().min(1),
  JWT_PRIVATE_KEY_BASE64: z.string().min(1), // Base64-encoded JSON string
  M2M_TOKEN_EXPIRY_SECONDS: z.string().regex(/^\d+$/).optional(),
});

// Request body validation
const tokenRequestSchema = z.object({
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
});

// Validate environment variables on startup
const envResult = envSchema.safeParse({
  API_URL: Deno.env.get('API_URL'),
  SECRET_KEY: Deno.env.get('SECRET_KEY'),
  JWT_PRIVATE_KEY_BASE64: Deno.env.get('JWT_PRIVATE_KEY_BASE64'),
  M2M_TOKEN_EXPIRY_SECONDS: Deno.env.get('M2M_TOKEN_EXPIRY_SECONDS'),
});

if (!envResult.success) {
  console.error(
    'Environment variable validation failed:',
    envResult.error.format()
  );
  throw new Error('Server configuration error: Invalid environment variables');
}

const {
  API_URL,
  SECRET_KEY,
  JWT_PRIVATE_KEY_BASE64,
  M2M_TOKEN_EXPIRY_SECONDS,
} = envResult.data;

const tokenExpirySeconds = M2M_TOKEN_EXPIRY_SECONDS
  ? parseInt(M2M_TOKEN_EXPIRY_SECONDS, 10)
  : 900;

app.post('/', zValidator('json', tokenRequestSchema), async (c) => {
  try {
    // Import signing key
    const jwk = JSON.parse(atob(JWT_PRIVATE_KEY_BASE64));
    const { key_ops: _, ...cleanJwk } = jwk;
    const importedKey = await importJWK(cleanJwk, jwk.alg || 'ES256');
    if (!(importedKey instanceof CryptoKey)) {
      throw new Error('Imported key is not a CryptoKey');
    }
    const signingKey: CryptoKey = importedKey;
    const alg = jwk.alg || 'ES256';
    const kid = jwk.kid;

    // Request body is already validated by middleware
    const { client_id, client_secret } = c.req.valid('json');

    // Verify client credentials
    const supabase = createClient(API_URL, SECRET_KEY);
    const machineSecret = await verifyClientCredentials(
      client_id,
      client_secret,
      supabase
    );

    // Sign JWT
    const jwt = await signJwt(
      signingKey,
      {
        sub: client_id,
        role: 'service',
        scopes: machineSecret.scopes,
      },
      {
        issuer: API_URL,
        expiresIn: tokenExpirySeconds,
        algorithm: alg,
        keyId: kid,
      }
    );

    return c.json({
      access_token: jwt,
      token_type: 'Bearer',
      expires_in: tokenExpirySeconds,
      scope: machineSecret.scopes.join(' '),
    });
  } catch (error) {
    console.error('Error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

Deno.serve(app.fetch);

async function verifyClientCredentials(
  clientId: string,
  clientSecret: string,
  supabase: SupabaseClient
): Promise<MachineSecret> {
  const { data, error } = await supabase
    .from('machine_secrets')
    .select(
      'client_id, client_secret_hash, scopes, is_active, created_at, updated_at'
    )
    .eq('client_id', clientId)
    .eq('is_active', true)
    .single();

  if (error) {
    // Supabase returns error when .single() finds 0 rows
    if (error.code === 'PGRST116') {
      throw new Error(`Machine secret with client_id ${clientId} not found`);
    }
    throw new Error(`Database error: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Machine secret with client_id ${clientId} not found`);
  }

  const machineSecret: MachineSecret = data;

  const isValid = bcrypt.compare(
    clientSecret,
    machineSecret.client_secret_hash
  );
  if (!isValid) {
    throw new Error('Invalid client secret');
  }

  return machineSecret;
}

async function signJwt(
  signingKey: CryptoKey,
  claims: Record<string, unknown>,
  options: {
    issuer: string;
    expiresIn: number; // seconds
    algorithm: string;
    keyId: string;
  }
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return await new SignJWT(claims)
    .setProtectedHeader({ alg: options.algorithm, kid: options.keyId })
    .setIssuedAt(now)
    .setIssuer(options.issuer)
    .setExpirationTime(now + options.expiresIn)
    .sign(signingKey);
}
