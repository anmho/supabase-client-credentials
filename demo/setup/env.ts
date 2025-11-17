// Environment variable validation and configuration

import { z } from 'zod';

// Environment variables schema
// Uses SECRET_KEY (sb_secret_...) - the modern API key format
// See: https://supabase.com/docs/guides/api/api-keys
const envSchema = z
  .object({
    SUPABASE_URL: z.string().url().default('http://localhost:54321'),
    SUPABASE_SECRET_KEY: z.string().min(1).optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    PORT: z
      .string()
      .regex(/^\d+$/)
      .default('3000')
      .transform((val) => parseInt(val, 10)),
  })
  .refine(
    (data) => data.SUPABASE_SECRET_KEY || data.SUPABASE_SERVICE_ROLE_KEY,
    {
      message:
        'Either SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY must be provided',
    }
  );

// Validate and export environment variables
const envResult = envSchema.safeParse({
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  PORT: process.env.PORT,
});

if (!envResult.success) {
  console.error('❌ Error: Invalid environment variables');
  console.error(envResult.error.format());
  process.exit(1);
}

export const env = envResult.data;

// Prefer SECRET_KEY (modern sb_secret_... format), fallback to SERVICE_ROLE_KEY (deprecated JWT)
// Both provide elevated privileges and bypass RLS
const apiKeyValue = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!apiKeyValue) {
  console.error(
    '❌ Error: Missing SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY'
  );
  console.error('Run: ./generate-env.sh');
  process.exit(1);
}
// TypeScript doesn't know process.exit() never returns, so we assert the type
export const apiKey = apiKeyValue as string;
