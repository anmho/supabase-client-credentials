import { z } from 'zod';

// Route parameter schemas
export const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

// Employee request body schemas
export const createEmployeeBodySchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().optional(),
});

export const updateEmployeeBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
});

