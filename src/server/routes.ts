import { Hono } from 'hono';

export const api = new Hono().get('/check', (c) => {
  return c.json({
    message: 'Hello from the API!',
    timestamp: new Date().toISOString(),
  });
});

export type APIRoutes = typeof api;
