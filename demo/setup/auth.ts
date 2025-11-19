// Authentication middleware and JWT verification

import type { Context, Next } from 'hono';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import type { JWTPayload } from 'jose';

function createVerifier(jwksUrl: string) {
  const projectJwks = createRemoteJWKSet(new URL(jwksUrl));

  return async function verifyJWT(
    token: string
  ): Promise<{ valid: boolean; payload?: JWTPayload }> {
    try {
      const { payload } = await jwtVerify(token, projectJwks);
      return { valid: true, payload };
    } catch {
      return { valid: false };
    }
  };
}

export function createAuthMiddleware(jwksUrl: string) {
  const verifyJWT = createVerifier(jwksUrl);

  return async function authMiddleware(c: Context, next: Next) {
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
  };
}
