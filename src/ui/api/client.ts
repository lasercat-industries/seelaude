import { hc } from 'hono/client';
import type { APIRoutes } from 'src/server/routes';

// Create the RPC client with type safety
export const apiClient = hc<APIRoutes>('/api');

// Custom error class for API errors
export class APIError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// Typed API methods
export const api = {
  check: () => apiClient.check.$get(),
} as const;
