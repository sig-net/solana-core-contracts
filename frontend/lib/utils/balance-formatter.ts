import { erc20Abi, formatUnits } from 'viem';
import { getPublicClient } from '@/lib/viem/providers';
import { getTokenMetadata } from '@/lib/constants/token-metadata';

export interface FormatBalanceOptions {
  /** Manual precision override (decimal places to show) */
  precision?: number;
  /** Use compact notation with K/M suffixes */
  compact?: boolean;
  /** Include token symbol in output */
  showSymbol?: boolean;
  /** Show USD value instead of token amount */
  showUsd?: boolean;
  /** USD price per token for conversion */
  usdPrice?: number;
  /** Fallback decimals if contract call fails */
  fallbackDecimals?: number;
  /** Override token symbol (useful for display symbols) */
  symbol?: string;
}

interface TokenDecimalInfo {
  decimals: number;
  symbol?: string;
  timestamp: number;
}

// Unified cache for token decimals and basic info
const tokenDecimalCache = new Map<string, TokenDecimalInfo>();
const CACHE_TTL = 300000; // 5 minutes

/**
 * Fetch token decimals and symbol from blockchain with caching
 */
async function fetchTokenDecimals(
  tokenAddress: string,
): Promise<TokenDecimalInfo> {
  const cacheKey = tokenAddress.toLowerCase();
  const cached = tokenDecimalCache.get(cacheKey);
  const now = Date.now();

  // Return cached data if still valid
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached;
  }

  const provider = getPublicClient();

  try {
    // Fetch decimals and symbol in parallel from contract
    const [decimals, symbol] = await Promise.all([
      provider.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'decimals',
      }),
      provider
        .readContract({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'symbol',
        })
        .catch(() => undefined), // Symbol is optional, don't fail if unavailable
    ]);

    const result: TokenDecimalInfo = {
      decimals: Number(decimals),
      symbol: symbol as string | undefined,
      timestamp: now,
    };

    // Cache the result
    tokenDecimalCache.set(cacheKey, result);
    return result;
  } catch (error) {
    // Fallback to token metadata or default
    console.warn(`Failed to fetch token info for ${tokenAddress}:`, error);

    const metadata = getTokenMetadata(tokenAddress);
    const result: TokenDecimalInfo = {
      decimals: metadata?.decimals || 18, // Default to 18 like ETH
      symbol: metadata?.symbol,
      timestamp: now,
    };

    // Cache fallback result for shorter duration
    tokenDecimalCache.set(cacheKey, {
      ...result,
      timestamp: now - CACHE_TTL + 60000, // Expire in 1 minute
    });

    return result;
  }
}

/**
 * Get cached token decimals synchronously (returns fallback if not cached)
 */
function getCachedTokenDecimals(tokenAddress: string): TokenDecimalInfo {
  const cacheKey = tokenAddress.toLowerCase();
  const cached = tokenDecimalCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached;
  }

  // Return fallback if not cached
  const metadata = getTokenMetadata(tokenAddress);
  return {
    decimals: metadata?.decimals || 18,
    symbol: metadata?.symbol,
    timestamp: 0, // Mark as stale
  };
}

/**
 * Calculate smart precision based on amount size
 */
function calculateSmartPrecision(
  numericAmount: number,
  maxDecimals: number,
): number {
  if (numericAmount >= 1000) {
    return Math.min(2, maxDecimals);
  } else if (numericAmount >= 1) {
    return Math.min(4, maxDecimals);
  } else if (numericAmount >= 0.01) {
    return Math.min(6, maxDecimals);
  } else if (numericAmount > 0) {
    return Math.min(8, maxDecimals);
  }
  return 2; // For zero amounts
}

/**
 * Apply compact formatting with K/M suffixes
 */
function applyCompactFormatting(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(2)}B`;
  } else if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(2)}M`;
  } else if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(2)}K`;
  }
  return amount.toString();
}

/**
 * Core formatting logic (used by both sync and async versions)
 */
function formatBalanceCore(
  amount: bigint | string,
  decimals: number,
  symbol: string | undefined,
  options: FormatBalanceOptions = {},
): string {
  const {
    precision,
    compact = false,
    showSymbol = false,
    showUsd = false,
    usdPrice,
    symbol: symbolOverride,
  } = options;

  // Convert amount to bigint if needed
  const amountBigInt = typeof amount === 'string' ? BigInt(amount) : amount;

  // Convert to decimal using viem's formatUnits for consistency
  const formattedAmount = formatUnits(amountBigInt, decimals);
  const numericAmount = parseFloat(formattedAmount);

  // Handle USD conversion
  if (showUsd && usdPrice) {
    const usdValue = numericAmount * usdPrice;
    if (usdValue === 0) return '$0.00';
    if (usdValue < 0.01) return '<$0.01';

    if (compact) {
      return `$${applyCompactFormatting(usdValue)}`;
    }

    if (usdValue >= 1_000_000) {
      return `$${(usdValue / 1_000_000).toFixed(1)}M`;
    } else if (usdValue >= 1_000) {
      return `$${(usdValue / 1_000).toFixed(1)}K`;
    }

    return `$${usdValue.toFixed(2)}`;
  }

  // Calculate precision
  const actualPrecision =
    precision !== undefined
      ? Math.min(precision, decimals)
      : calculateSmartPrecision(numericAmount, decimals);

  // Format the number
  let result: string;

  if (compact) {
    result = applyCompactFormatting(numericAmount);
  } else {
    // Use toFixed and remove trailing zeros
    result = numericAmount.toFixed(actualPrecision).replace(/\.?0+$/, '');

    // Add thousand separators for large whole numbers
    if (!result.includes('.') && numericAmount >= 1000) {
      result = parseInt(result).toLocaleString();
    }
  }

  // Add symbol if requested
  if (showSymbol && (symbolOverride || symbol)) {
    result = `${result} ${symbolOverride || symbol}`;
  }

  return result;
}

/**
 * Format token balance with automatic decimal fetching from blockchain
 * This is the main function you should use for most cases
 *
 * @param amount - Raw token amount (bigint or string)
 * @param tokenAddress - ERC20 contract address for decimal fetching
 * @param options - Formatting options
 * @returns Promise<string> - Formatted balance string
 *
 * @example
 * // Basic usage
 * const formatted = await formatTokenBalance(amount, tokenAddress);
 *
 * // With symbol
 * const withSymbol = await formatTokenBalance(amount, tokenAddress, { showSymbol: true });
 *
 * // Compact format
 * const compact = await formatTokenBalance(amount, tokenAddress, { compact: true });
 *
 * // USD value
 * const usd = await formatTokenBalance(amount, tokenAddress, {
 *   showUsd: true,
 *   usdPrice: 1.00
 * });
 */
export async function formatTokenBalance(
  amount: bigint | string,
  tokenAddress: string,
  options: FormatBalanceOptions = {},
): Promise<string> {
  const { fallbackDecimals, symbol: symbolOverride } = options;

  try {
    const tokenInfo = await fetchTokenDecimals(tokenAddress);
    return formatBalanceCore(
      amount,
      tokenInfo.decimals,
      symbolOverride || tokenInfo.symbol,
      options,
    );
  } catch (error) {
    console.warn(`Failed to format token balance for ${tokenAddress}:`, error);

    // Use fallback decimals or default
    const decimals = fallbackDecimals || 18;
    return formatBalanceCore(amount, decimals, symbolOverride, options);
  }
}

/**
 * Format token balance synchronously when decimals are already known
 * Use this when you already have the token decimals to avoid async calls
 *
 * @param amount - Raw token amount (bigint or string)
 * @param decimals - Number of decimal places for the token
 * @param symbol - Optional token symbol
 * @param options - Formatting options
 * @returns string - Formatted balance string
 *
 * @example
 * // Basic usage with known decimals
 * const formatted = formatTokenBalanceSync(amount, 6);
 *
 * // With symbol and compact format
 * const compact = formatTokenBalanceSync(amount, 6, 'USDC', {
 *   showSymbol: true,
 *   compact: true
 * });
 */
export function formatTokenBalanceSync(
  amount: bigint | string,
  decimals: number,
  symbol?: string,
  options: FormatBalanceOptions = {},
): string {
  return formatBalanceCore(amount, decimals, symbol, options);
}

/**
 * Format token balance using cached decimals (synchronous)
 * Falls back to default decimals if not cached
 *
 * @param amount - Raw token amount (bigint or string)
 * @param tokenAddress - ERC20 contract address
 * @param options - Formatting options
 * @returns string - Formatted balance string
 */
export function formatTokenBalanceCached(
  amount: bigint | string,
  tokenAddress: string,
  options: FormatBalanceOptions = {},
): string {
  const tokenInfo = getCachedTokenDecimals(tokenAddress);
  return formatBalanceCore(
    amount,
    tokenInfo.decimals,
    tokenInfo.symbol,
    options,
  );
}

/**
 * Preload token decimals for multiple addresses to populate cache
 * Useful for optimizing performance when you know which tokens will be displayed
 */
export async function preloadTokenDecimals(
  tokenAddresses: string[],
): Promise<void> {
  const promises = tokenAddresses.map(address =>
    fetchTokenDecimals(address).catch(err =>
      console.warn(`Failed to preload decimals for ${address}:`, err),
    ),
  );
  await Promise.allSettled(promises);
}

/**
 * Clear the token decimals cache
 * Useful for testing or forcing refresh of token data
 */
export function clearTokenDecimalsCache(): void {
  tokenDecimalCache.clear();
}

/**
 * Get cache statistics for debugging
 */
export function getTokenDecimalsCacheStats(): {
  size: number;
  entries: Array<{
    address: string;
    decimals: number;
    symbol?: string;
    age: number;
  }>;
} {
  const now = Date.now();
  const entries = Array.from(tokenDecimalCache.entries()).map(
    ([address, info]) => ({
      address,
      decimals: info.decimals,
      symbol: info.symbol,
      age: now - info.timestamp,
    }),
  );

  return { size: tokenDecimalCache.size, entries };
}
