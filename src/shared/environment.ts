const requiredEnvVars = [] as const;

function validateEnvVar(key: string): string {
  const value = import.meta.env[key] || process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  isProduction: import.meta.env.PROD || import.meta.env['NODE_ENV'] === 'production',
  isDevelopment: import.meta.env.DEV || import.meta.env['NODE_ENV'] === 'development',
  port: import.meta.env['PORT'] || '3000',
} as const;

// Validate all required environment variables at startup
requiredEnvVars.forEach((key) => {
  validateEnvVar(key);
});

export type Environment = typeof env;
