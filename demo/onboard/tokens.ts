// Token refresh utility for M2M client credentials flow
// Simple, functional approach - refreshes tokens proactively before expiration

import { decodeJwt } from 'jose';

// Refresh buffer: 10% of token lifetime or 5 minutes minimum
const REFRESH_BUFFER_PERCENT = 0.1;
const MIN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

// Global state
let token: string | null = null;
let expiresAt: Date | null = null;
let timer: Timer | null = null;
let clientId: string | null = null;
let clientSecret: string | null = null;
let tokenUrl: string | null = null;
let refreshing: Promise<void> | null = null;

// Refresh the token
async function refresh(): Promise<void> {
  if (!clientId || !clientSecret || !tokenUrl) {
    throw new Error('Token refresher not initialized');
  }

  if (refreshing) return refreshing;

  refreshing = (async () => {
    try {
      console.log('🔄 Refreshing M2M token...');
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Token request failed: ${response.status} - ${JSON.stringify(error)}`);
      }

      const data = (await response.json()) as { access_token: string };
      const payload = decodeJwt(data.access_token);

      if (!payload.exp) {
        throw new Error('Token missing expiration claim (exp)');
      }

      // Calculate refresh time: 10% of lifetime or 5min, whichever is larger
      const actualExpiry = new Date(payload.exp * 1000);
      const lifetime = actualExpiry.getTime() - Date.now();
      const buffer = Math.max(lifetime * REFRESH_BUFFER_PERCENT, MIN_REFRESH_BUFFER_MS);

      token = data.access_token;
      expiresAt = new Date(actualExpiry.getTime() - buffer);

      // Schedule next refresh
      if (timer) clearTimeout(timer);
      const timeUntilRefresh = expiresAt.getTime() - Date.now();
      if (timeUntilRefresh > 0) {
        timer = setTimeout(() => refresh().catch(console.error), timeUntilRefresh);
        const minutes = Math.floor(timeUntilRefresh / 1000 / 60);
        console.log(`⏰ Next refresh scheduled in ${minutes}m`);
      }

      const minutes = Math.floor(timeUntilRefresh / 1000 / 60);
      console.log(`✅ Token refreshed! Next refresh in ${minutes}m`);
    } catch (error: any) {
      console.error('❌ Token refresh failed:', error.message);
      token = null;
      expiresAt = null;
      throw error;
    } finally {
      refreshing = null;
    }
  })();

  return refreshing;
}

// Start the token refresher
export async function startRefresher(id: string, secret: string, url: string): Promise<void> {
  clientId = id;
  clientSecret = secret;
  tokenUrl = url;
  console.log('🚀 Starting token refresher...');
  await refresh();
  console.log('✅ Token refresher started');
}

// Stop the token refresher
export function stopRefresher(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  token = null;
  expiresAt = null;
  clientId = null;
  clientSecret = null;
  tokenUrl = null;
}

// Get a valid token, refreshing if necessary
export async function getToken(): Promise<string> {
  if (token && expiresAt && new Date() < expiresAt) {
    return token;
  }
  await refresh();
  if (!token) {
    throw new Error('Failed to acquire token');
  }
  return token;
}
