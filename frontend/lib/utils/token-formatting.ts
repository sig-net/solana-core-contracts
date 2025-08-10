import { erc20Abi } from 'viem';
import { Contract } from 'alchemy-sdk';

// This file handles token metadata fetching and caching
// For balance formatting, use @/lib/utils/balance-formatter instead

import type { TokenFormatInfo } from '@/lib/types/token.types';

import { getAlchemyProvider } from './providers';

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

// Cache for token information to avoid repeated contract calls (memory)
const tokenInfoCache = new Map<
  string,
  {
    data: TokenFormatInfo;
    timestamp: number;
  }
>();

// Cache duration: 24 hours for token metadata (stable)
const CACHE_DURATION = 24 * 60 * 60 * 1000;

function getLocalStorageKey(address: string) {
  return `tokenInfo:${address.toLowerCase()}`;
}

function readFromLocalStorage(address: string): TokenFormatInfo | null {
  try {
    const raw = localStorage.getItem(getLocalStorageKey(address));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      data: TokenFormatInfo;
      timestamp: number;
    };
    if (Date.now() - parsed.timestamp > CACHE_DURATION) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeToLocalStorage(address: string, data: TokenFormatInfo) {
  try {
    const payload = JSON.stringify({ data, timestamp: Date.now() });
    localStorage.setItem(getLocalStorageKey(address), payload);
  } catch {
    // ignore quota / SSR
  }
}

// Default fallback token info
const DEFAULT_TOKEN_INFO: TokenFormatInfo = {
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
): Promise<TokenFormatInfo> {
  const alchemy = getAlchemyProvider();
  const provider = await alchemy.config.getProvider();
  const contract = new Contract(tokenAddress, erc20Abi, provider);

  try {
    const [symbol, name, decimals] = await Promise.all([
      contract.symbol(),
      contract.name(),
      contract.decimals(),
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
export async function getTokenInfo(
  tokenAddress: string,
): Promise<TokenFormatInfo> {
  const normalizedAddress = tokenAddress.toLowerCase();
  const cached = tokenInfoCache.get(normalizedAddress);

  // Return cached data if it's still valid
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  // Try localStorage cache (client only)
  const ls =
    typeof window !== 'undefined' ? readFromLocalStorage(tokenAddress) : null;
  if (ls) {
    tokenInfoCache.set(normalizedAddress, { data: ls, timestamp: Date.now() });
    return ls;
  }

  // Fetch fresh data from contract (Alchemy)
  const tokenInfo = await fetchTokenInfoFromContract(tokenAddress);

  // Cache the result
  tokenInfoCache.set(normalizedAddress, {
    data: tokenInfo,
    timestamp: Date.now(),
  });
  if (typeof window !== 'undefined')
    writeToLocalStorage(tokenAddress, tokenInfo);

  return tokenInfo;
}

/**
 * Get token information synchronously (returns cached data or default)
 * Use this when you need immediate results and can handle defaults
 */
export function getTokenInfoSync(tokenAddress: string): TokenFormatInfo {
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
