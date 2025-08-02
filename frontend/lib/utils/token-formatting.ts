import { erc20Abi } from 'viem';

import { getPublicClient } from '@/lib/viem/providers';

// This file handles token metadata fetching and caching
// For balance formatting, use @/lib/utils/balance-formatter instead

export interface TokenInfo {
  symbol: string;
  decimals: number;
  name: string;
  displaySymbol: string; // Normalized symbol for icon display
}

// Symbol normalization mapping for icon display
// Maps contract symbols to standardized symbols that @web3icons/react recognizes
const SYMBOL_NORMALIZATION_MAP: Record<string, string> = {
  // USDC variants
  USDC: 'USDC',
  'USDC.e': 'USDC',
  'USD Coin': 'USDC',
  USDCoin: 'USDC',

  // ETH variants
  ETH: 'ETH',
  WETH: 'ETH',
  'Wrapped Ether': 'ETH',

  // SOL variants
  SOL: 'SOL',
  WSOL: 'SOL',
  'Wrapped SOL': 'SOL',

  // BTC variants
  BTC: 'BTC',
  WBTC: 'BTC',
  'Wrapped Bitcoin': 'BTC',

  // Add more mappings as needed
};

/**
 * Normalize token symbol for icon display
 */
function normalizeSymbolForDisplay(symbol: string, name: string): string {
  // Try exact symbol match first
  if (SYMBOL_NORMALIZATION_MAP[symbol]) {
    return SYMBOL_NORMALIZATION_MAP[symbol];
  }

  // Try name match
  if (SYMBOL_NORMALIZATION_MAP[name]) {
    return SYMBOL_NORMALIZATION_MAP[name];
  }

  // Try partial matches for common patterns
  const symbolUpper = symbol.toUpperCase();
  if (symbolUpper.includes('USDC')) return 'USDC';
  if (symbolUpper.includes('ETH')) return 'ETH';
  if (symbolUpper.includes('SOL')) return 'SOL';
  if (symbolUpper.includes('BTC')) return 'BTC';

  // Fallback to original symbol
  return symbol;
}

// Cache for token information to avoid repeated contract calls
const tokenInfoCache = new Map<
  string,
  {
    data: TokenInfo;
    timestamp: number;
  }
>();

// Cache duration: 1 hour
const CACHE_DURATION = 60 * 60 * 1000;

// Default fallback token info
const DEFAULT_TOKEN_INFO: TokenInfo = {
  symbol: 'ERC20',
  decimals: 18,
  name: 'Unknown Token',
  displaySymbol: 'ERC20',
};

/**
 * Fetch token information from ERC20 contract
 */
async function fetchTokenInfoFromContract(
  tokenAddress: string,
): Promise<TokenInfo> {
  const provider = getPublicClient();

  try {
    const [symbol, name, decimals] = await Promise.all([
      provider.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'symbol',
      }),
      provider.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'name',
      }),
      provider.readContract({
        address: tokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'decimals',
      }),
    ]);

    const symbolStr = symbol as string;
    const nameStr = name as string;

    return {
      symbol: symbolStr,
      name: nameStr,
      decimals: Number(decimals),
      displaySymbol: normalizeSymbolForDisplay(symbolStr, nameStr),
    };
  } catch (error) {
    console.warn(`Failed to fetch token info for ${tokenAddress}:`, error);
    return DEFAULT_TOKEN_INFO;
  }
}

/**
 * Get token information with caching
 */
export async function getTokenInfo(tokenAddress: string): Promise<TokenInfo> {
  const normalizedAddress = tokenAddress.toLowerCase();
  const cached = tokenInfoCache.get(normalizedAddress);

  // Return cached data if it's still valid
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  // Fetch fresh data from contract
  const tokenInfo = await fetchTokenInfoFromContract(tokenAddress);

  // Cache the result
  tokenInfoCache.set(normalizedAddress, {
    data: tokenInfo,
    timestamp: Date.now(),
  });

  return tokenInfo;
}

/**
 * Get token information synchronously (returns cached data or default)
 * Use this when you need immediate results and can handle defaults
 */
export function getTokenInfoSync(tokenAddress: string): TokenInfo {
  const normalizedAddress = tokenAddress.toLowerCase();
  const cached = tokenInfoCache.get(normalizedAddress);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  return DEFAULT_TOKEN_INFO;
}

/**
 * Preload token information for multiple addresses
 */
export async function preloadTokenInfo(
  tokenAddresses: string[],
): Promise<void> {
  const promises = tokenAddresses.map(address => getTokenInfo(address));
  await Promise.allSettled(promises);
}

export { formatActivityDate } from './date-formatting';
