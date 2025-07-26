/**
 * RPC optimization utilities to prevent flooding and improve reliability
 */

/**
 * Exponential backoff with jitter for retry logic
 */
export function exponentialBackoff(
  attempt: number,
  baseDelay = 1000,
  maxDelay = 30000,
): number {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.1 * delay;
  return delay + jitter;
}

/**
 * Rate limiter using token bucket algorithm
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per second

  constructor(capacity: number, refillRate: number) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  /**
   * Check if a request can be made and consume a token if available
   */
  tryConsume(tokensRequested = 1): boolean {
    this.refill();

    if (this.tokens >= tokensRequested) {
      this.tokens -= tokensRequested;
      return true;
    }

    return false;
  }

  /**
   * Get the time until the next token is available
   */
  getRetryAfter(): number {
    this.refill();
    if (this.tokens >= 1) return 0;

    const tokensNeeded = 1 - this.tokens;
    return Math.ceil((tokensNeeded / this.refillRate) * 1000);
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.refillRate;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

/**
 * Debounced function executor
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func.apply(null, args);
    }, wait);
  };
}

/**
 * Request deduplication cache
 */
export class RequestDeduplicator {
  private pending = new Map<string, Promise<any>>();
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly cacheTTL: number;

  constructor(cacheTTL = 5000) {
    this.cacheTTL = cacheTTL;
  }

  /**
   * Execute a request with deduplication and caching
   */
  async execute<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    // Check cache first
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    // Check if request is already pending
    if (this.pending.has(key)) {
      return this.pending.get(key);
    }

    // Execute new request
    const promise = requestFn().finally(() => {
      this.pending.delete(key);
    });

    this.pending.set(key, promise);

    try {
      const result = await promise;
      // Cache successful result
      this.cache.set(key, { data: result, timestamp: Date.now() });
      return result;
    } catch (error) {
      // Don't cache errors, but clean up
      this.cache.delete(key);
      throw error;
    }
  }

  /**
   * Clear cache entries older than TTL
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTTL) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Global rate limiters for different RPC providers
 */
export const RATE_LIMITERS = {
  // Alchemy free tier: 300 requests per second
  alchemy: new RateLimiter(300, 5), // 5 requests per second to be conservative

  // Solana mainnet: more generous
  solana: new RateLimiter(100, 10), // 10 requests per second

  // CoinGecko: 10-50 requests per minute depending on plan
  coingecko: new RateLimiter(10, 0.16), // ~10 requests per minute
} as const;

/**
 * Global request deduplicator
 */
export const REQUEST_DEDUPLICATOR = new RequestDeduplicator(5000);

/**
 * Cleanup interval for request deduplicator
 */
if (typeof window !== 'undefined') {
  setInterval(() => {
    REQUEST_DEDUPLICATOR.cleanup();
  }, 30000); // Cleanup every 30 seconds
}
