const DEFAULT_ALLOWED_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
];

export function readApiRuntimeConfig(env = process.env) {
  const port = Number(env.CREANCE_API_PORT || 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('CREANCE_API_PORT must be an integer from 1 to 65535.');
  }

  const maxBodyBytes = Number(env.CREANCE_MAX_BODY_BYTES || 1_048_576);
  if (!Number.isInteger(maxBodyBytes) || maxBodyBytes < 1 || maxBodyBytes > 10_485_760) {
    throw new Error('CREANCE_MAX_BODY_BYTES must be an integer from 1 to 10485760.');
  }

  const allowedOrigins = (env.CREANCE_ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(','))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  for (const origin of allowedOrigins) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`Invalid CREANCE_ALLOWED_ORIGINS entry: ${origin}`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) {
      throw new Error(`Invalid CREANCE_ALLOWED_ORIGINS entry: ${origin}`);
    }
  }

  return {
    host: env.CREANCE_API_HOST || '127.0.0.1',
    port,
    maxBodyBytes,
    allowedOrigins,
  };
}

export function corsHeaders(origin, allowedOrigins) {
  if (!origin || !allowedOrigins.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}
