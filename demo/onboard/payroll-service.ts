#!/usr/bin/env bun
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { getToken, startRefresher, stopRefresher } from './tokens';
import { env } from './env';

const { CLIENT_ID, CLIENT_SECRET, SUPABASE_URL, API_URL } = env;
const M2M_TOKEN_URL = `${SUPABASE_URL}/functions/v1/m2m-token`;

const app = new Hono();

app.use('/*', cors({ origin: '*' }));

app.onError((err, c) => {
  console.error('Error:', err);
  const status = err.message.includes('not found') ? 404 : 500;
  return c.json({ error: err.message }, status);
});

const paymentSchema = z.object({
  employeeId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  description: z.string().optional(),
});

app.get('/health', (c) => c.json({ status: 'ok' }));

app.post('/payments', zValidator('json', paymentSchema), async (c) => {
  const { employeeId, amount, currency, description } = c.req.valid('json');

  const token = await getToken();
  const response = await fetch(`${API_URL}/employees/${employeeId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    return c.json({ error: 'Employee not found' }, 404);
  }

  const { data: employee } = (await response.json()) as {
    data: { id: string; name: string; email: string | null };
  };

  if (!employee.email) {
    return c.json({ error: 'Employee has no email address' }, 400);
  }

  const paymentId = `pay_${Date.now()}_${Math.random()
    .toString(36)
    .substring(7)}`;
  const emailId = `email_${Date.now()}_${Math.random()
    .toString(36)
    .substring(7)}`;

  console.log(
    `📧 Payroll email: ${employee.email} - ${currency} ${amount.toFixed(2)}`
  );

  return c.json(
    {
      payment: {
        paymentId,
        employeeId: employee.id,
        employeeName: employee.name,
        amount,
        currency,
        description: description || `Payroll payment for ${employee.name}`,
        status: 'completed',
        processedAt: new Date().toISOString(),
      },
      email: {
        sent: true,
        emailId,
        recipient: employee.email,
        sentAt: new Date().toISOString(),
      },
    },
    201
  );
});

(async () => {
  try {
    await startRefresher(CLIENT_ID, CLIENT_SECRET, M2M_TOKEN_URL);
    console.log(`✅ Payroll Service running on http://localhost:${env.PORT}`);
  } catch (error: any) {
    console.error('❌ Failed to start:', error.message);
    process.exit(1);
  }
})();

process.on('SIGINT', () => {
  stopRefresher();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopRefresher();
  process.exit(0);
});

export default {
  port: env.PORT,
  fetch: app.fetch,
};
