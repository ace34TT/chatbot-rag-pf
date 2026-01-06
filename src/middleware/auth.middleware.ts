import { Context, Next } from 'hono';
import { env } from '../config/env.js';

// Parse API keys from comma-separated string
const validApiKeys = new Set(
  env.API_KEYS.split(',').map((key) => key.trim()).filter(Boolean)
);

export const apiKeyAuth = async (c: Context, next: Next) => {
  // Get API key from header
  const apiKey = c.req.header('X-API-Key') || c.req.header('Authorization')?.replace('Bearer ', '');

  if (!apiKey) {
    return c.json(
      {
        error: 'Unauthorized',
        message: 'API key is required. Please provide it via X-API-Key header or Authorization Bearer token.',
      },
      401
    );
  }

  if (!validApiKeys.has(apiKey)) {
    return c.json(
      {
        error: 'Forbidden',
        message: 'Invalid API key.',
      },
      403
    );
  }

  // API key is valid, proceed to next middleware/route
  await next();
};
