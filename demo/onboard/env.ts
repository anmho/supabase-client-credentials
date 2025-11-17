// Environment variable validation and configuration

import { z } from 'zod';

const envSchema = z.object({
  CLIENT_ID: z.string().min(1, 'CLIENT_ID is required'),
  CLIENT_SECRET: z.string().min(1, 'CLIENT_SECRET is required'),
  SUPABASE_URL: z.string().url().default('http://localhost:54321'),
  API_URL: z.string().url().default('http://localhost:3000'),
  PORT: z
    .string()
    .regex(/^\d+$/)
    .default('4000')
    .transform((val) => parseInt(val, 10)),
});

// Validate and export environment variables
const envResult = envSchema.safeParse({
  CLIENT_ID: Bun.env.CLIENT_ID,
  CLIENT_SECRET: Bun.env.CLIENT_SECRET,
  SUPABASE_URL: Bun.env.SUPABASE_URL,
  API_URL: Bun.env.API_URL,
  PORT: Bun.env.PORT,
});

if (!envResult.success) {
  console.error('❌ Error: Invalid environment variables');
  console.error(envResult.error.format());
  process.exit(1);
}

export const env = envResult.data;
