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
