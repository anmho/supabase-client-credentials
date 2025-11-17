// Authentication middleware and JWT verification

import type { Context, Next } from 'hono';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import type { JWTPayload } from 'jose';
import { env } from './env';

// Create JWKS client for JWT verification
// Uses the Supabase JWKS endpoint as recommended in the docs:
// https://supabase.com/docs/guides/auth/jwts
const JWKS_URL = `${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`;
const PROJECT_JWKS = createRemoteJWKSet(new URL(JWKS_URL));

// JWT verification helper using JWKS
async function verifyJWT(
  token: string
): Promise<{ valid: boolean; payload?: JWTPayload }> {
  try {
    const { payload } = await jwtVerify(token, PROJECT_JWKS);
    return { valid: true, payload };
  } catch (error) {
    return { valid: false };
  }
}

// Auth middleware
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const { valid, payload } = await verifyJWT(token);

  if (!valid || !payload) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  // Attach token payload to context
  c.set('user', payload);
  await next();
}
