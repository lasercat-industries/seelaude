import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { api } from './routes';
import { isProduction } from './utilities';
import { env } from '@shared/environment';

export const app = new Hono<{ Bindings: { PORT?: string } }>();
const port = env.port;

export const runtime = 'edge';

if (!isProduction) {
  app.use('*', cors({ origin: '*' }));
}

// Error handling middleware
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json(
      {
        error: err.message,
        status: err.status,
      },
      err.status,
    );
  }

  return c.json(
    {
      error: 'Internal Server Error',
      status: 500,
    },
    500,
  );
});

// API routes
app.route('/api', api);

// Health check
app.get('/', (c) => {
  return c.json({ message: 'Bun + Vite Full-Stack Server Running!' });
});

console.log(`🚀 Server running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};

export type * from './routes';
