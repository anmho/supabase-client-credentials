#!/usr/bin/env bun
// Bun Hono server with CRUD operations for employees
// Supports both user JWTs and M2M client credentials

import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { zValidator } from '@hono/zod-validator';
import { createClient } from '@supabase/supabase-js';
import type { JWTPayload } from 'jose';
import { env, apiKey, jwksUrl } from './env';
import { createAuthMiddleware } from './auth';
import {
  uuidParamSchema,
  createEmployeeBodySchema,
  updateEmployeeBodySchema,
} from './schemas';

// Create Supabase client with elevated privileges (bypasses RLS)
// Uses SECRET_KEY (sb_secret_...) - the recommended modern format
const supabase = createClient(env.SUPABASE_URL, apiKey);

// Create Hono app
const app = new Hono();

// Centralized error handler
app.onError((err, c) => {
  console.error('Error:', err);

  // Handle Supabase errors
  if (err.message.includes('PGRST116') || err.message.includes('not found')) {
    return c.json({ error: 'Employee not found' }, 404);
  }

  // Handle validation errors
  if (err.name === 'ZodError') {
    return c.json({ error: 'Validation error', details: err.message }, 400);
  }

  // Default error response
  const message = err instanceof Error ? err.message : 'Internal server error';
  return c.json({ error: message }, 500);
});

// CORS middleware
app.use(
  '/*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

// Health check (no auth required)
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Apply auth middleware to all employee routes
const authMiddleware = createAuthMiddleware(jwksUrl);
app.use('/employees/*', authMiddleware);

// GET /employees - List all employees
app.get('/employees', async (c) => {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return c.json({ data });
});

// GET /employees/:id - Get a specific employee
app.get('/employees/:id', zValidator('param', uuidParamSchema), async (c) => {
  const { id } = c.req.valid('param');
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return c.json({ error: 'Employee not found' }, 404);
    }
    throw new Error(error.message);
  }

  return c.json({ data });
});

// POST /employees - Create a new employee
app.post(
  '/employees',
  zValidator('json', createEmployeeBodySchema),
  async (c) => {
    const { name, email } = c.req.valid('json');
    const { data, error } = await supabase
      .from('employees')
      .insert({ name, email })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return c.json({ data }, 201);
  }
);

// PUT /employees/:id - Update an employee
app.put(
  '/employees/:id',
  zValidator('param', uuidParamSchema),
  zValidator('json', updateEmployeeBodySchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const updateData = c.req.valid('json');

    const { data, error } = await supabase
      .from('employees')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return c.json({ error: 'Employee not found' }, 404);
      }
      throw new Error(error.message);
    }

    return c.json({ data });
  }
);

// DELETE /employees/:id - Delete an employee
app.delete(
  '/employees/:id',
  zValidator('param', uuidParamSchema),
  async (c) => {
    const { id } = c.req.valid('param');
    const { error } = await supabase.from('employees').delete().eq('id', id);

    if (error) throw new Error(error.message);
    return c.json({ message: 'Employee deleted successfully' });
  }
);

// Get token info endpoint (for debugging)
app.get('/auth/me', authMiddleware, (c: Context) => {
  const user = c.get('user') as JWTPayload | undefined;
  return c.json({ user });
});

console.log(`🚀 Server starting on http://localhost:${env.PORT}`);
console.log(`📊 Supabase URL: ${env.SUPABASE_URL}`);
console.log(`🔐 JWKS URL: ${jwksUrl}`);

export default {
  port: env.PORT,
  fetch: app.fetch,
};
