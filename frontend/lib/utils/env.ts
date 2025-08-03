import { z } from 'zod';

// Environment variable schemas
const clientEnvSchema = z.object({
  NEXT_PUBLIC_ALCHEMY_API_KEY: z.string().min(1, 'Alchemy API key is required'),
  NEXT_PUBLIC_SEPOLIA_RPC_URL: z.string().optional(),
  NEXT_PUBLIC_SOLANA_RPC_URL: z.string().optional(),
});

const serverEnvSchema = z.object({
  RELAYER_PRIVATE_KEY: z.string().min(1, 'Relayer private key is required'),
});

// Combined schema for server-side usage
const fullEnvSchema = clientEnvSchema.merge(serverEnvSchema);

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type FullEnv = z.infer<typeof fullEnvSchema>;

// Cache for validated environment variables
let clientEnvCache: ClientEnv | null = null;
let serverEnvCache: ServerEnv | null = null;
let fullEnvCache: FullEnv | null = null;

/**
 * Get and validate client-side environment variables
 * Safe to use in browser and server environments
 */
export function getClientEnv(): ClientEnv {
  if (clientEnvCache) {
    return clientEnvCache;
  }

  const rawEnv = {
    NEXT_PUBLIC_ALCHEMY_API_KEY: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
    NEXT_PUBLIC_SEPOLIA_RPC_URL: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL,
    NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
  };

  try {
    clientEnvCache = clientEnvSchema.parse(rawEnv);
    return clientEnvCache;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      throw new Error(`Client environment validation failed: ${missingVars}`);
    }
    throw error;
  }
}

/**
 * Get and validate server-side environment variables
 * Only use in server-side code (API routes, etc.)
 */
export function getServerEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    throw new Error('getServerEnv() should only be called on the server side');
  }

  if (serverEnvCache) {
    return serverEnvCache;
  }

  const rawEnv = {
    RELAYER_PRIVATE_KEY: process.env.RELAYER_PRIVATE_KEY,
  };

  try {
    serverEnvCache = serverEnvSchema.parse(rawEnv);
    return serverEnvCache;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      throw new Error(`Server environment validation failed: ${missingVars}`);
    }
    throw error;
  }
}

/**
 * Get and validate all environment variables
 * Only use in server-side code (API routes, etc.)
 */
export function getFullEnv(): FullEnv {
  if (typeof window !== 'undefined') {
    throw new Error('getFullEnv() should only be called on the server side');
  }

  if (fullEnvCache) {
    return fullEnvCache;
  }

  const rawEnv = {
    NEXT_PUBLIC_ALCHEMY_API_KEY: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
    NEXT_PUBLIC_SEPOLIA_RPC_URL: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL,
    NEXT_PUBLIC_SOLANA_RPC_URL: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
    RELAYER_PRIVATE_KEY: process.env.RELAYER_PRIVATE_KEY,
  };

  try {
    fullEnvCache = fullEnvSchema.parse(rawEnv);
    return fullEnvCache;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues
        .map(err => `${err.path.join('.')}: ${err.message}`)
        .join(', ');
      throw new Error(`Environment validation failed: ${missingVars}`);
    }
    throw error;
  }
}

/**
 * Get RPC URL for Sepolia with fallback logic
 */
export function getSepoliaRpcUrl(): string {
  const env = getClientEnv();

  if (env.NEXT_PUBLIC_SEPOLIA_RPC_URL) {
    return env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
  }

  return `https://eth-sepolia.g.alchemy.com/v2/${env.NEXT_PUBLIC_ALCHEMY_API_KEY}`;
}

/**
 * Get Solana RPC URL with validation
 */
export function getSolanaRpcUrl(): string {
  const env = getClientEnv();

  if (!env.NEXT_PUBLIC_SOLANA_RPC_URL) {
    throw new Error('NEXT_PUBLIC_SOLANA_RPC_URL is required');
  }

  return env.NEXT_PUBLIC_SOLANA_RPC_URL;
}
