/**
 * Simplified RPC utilities
 */

/**
 * Get Sepolia RPC URL using Alchemy or custom URL
 */
export function getSepoliaRpcUrl(): string {
  const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  const customRpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;

  if (customRpcUrl) {
    return customRpcUrl;
  }

  if (alchemyApiKey) {
    return `https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`;
  }

  throw new Error(
    'Either NEXT_PUBLIC_ALCHEMY_API_KEY or NEXT_PUBLIC_SEPOLIA_RPC_URL must be set',
  );
}

/**
 * Simple exponential backoff for retry logic
 */
export function exponentialBackoff(
  attempt: number,
  baseDelay = 1000,
  maxDelay = 30000,
): number {
  return Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
}

/**
 * Simple rate limiter using minimum delay between requests
 */
export class SimpleRateLimiter {
  private lastRequestTime = 0;
  private readonly minDelayMs: number;

  constructor(requestsPerSecond: number) {
    this.minDelayMs = 1000 / requestsPerSecond;
  }

  /**
   * Wait if necessary to respect rate limit, then proceed
   */
  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minDelayMs) {
      const waitTime = this.minDelayMs - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }
}

/**
 * Simple debounced function executor
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), wait);
  };
}

/**
 * Simple request cache to avoid duplicate calls
 */
export class SimpleCache {
  private cache = new Map<string, { data: any; expires: number }>();
  private pending = new Map<string, Promise<any>>();

  /**
   * Execute request with simple caching and deduplication
   */
  async get<T>(key: string, requestFn: () => Promise<T>, ttlMs = 5000): Promise<T> {
    // Check cache
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expires) {
      return cached.data;
    }

    // Check pending
    if (this.pending.has(key)) {
      return this.pending.get(key);
    }

    // Execute request
    const promise = requestFn().finally(() => this.pending.delete(key));
    this.pending.set(key, promise);

    try {
      const result = await promise;
      this.cache.set(key, { data: result, expires: Date.now() + ttlMs });
      return result;
    } catch (error) {
      this.cache.delete(key);
      throw error;
    }
  }
}

/**
 * Global rate limiter and cache
 */
export const RPC_RATE_LIMITER = new SimpleRateLimiter(20); // 20 requests per second
export const RPC_CACHE = new SimpleCache();

/**
 * Rate limited request wrapper
 */
export async function rateLimitedRequest<T>(requestFn: () => Promise<T>): Promise<T> {
  await RPC_RATE_LIMITER.waitIfNeeded();
  return requestFn();
}

/**
 * Cached and rate limited request
 */
export async function cachedRequest<T>(
  cacheKey: string,
  requestFn: () => Promise<T>,
  ttlMs = 5000,
): Promise<T> {
  return RPC_CACHE.get(cacheKey, async () => {
    await RPC_RATE_LIMITER.waitIfNeeded();
    return requestFn();
  }, ttlMs);
}
