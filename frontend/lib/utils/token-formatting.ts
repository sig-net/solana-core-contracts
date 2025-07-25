import { erc20Abi } from 'viem';
import { getAutomatedProvider } from '@/lib/viem/providers';

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
  const provider = getAutomatedProvider();

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

/**
 * Format token amount with automatic token info fetching
 */
export async function formatTokenAmount(
  value: bigint,
  tokenAddress: string,
  options: {
    showSymbol?: boolean;
    precision?: number;
    compact?: boolean;
  } = {},
): Promise<string> {
  const { showSymbol = true, precision, compact = false } = options;
  const tokenInfo = await getTokenInfo(tokenAddress);

  const divisor = BigInt(10 ** tokenInfo.decimals);
  const wholePart = value / divisor;
  const fractionalPart = value % divisor;

  let formattedAmount: string;

  if (fractionalPart === BigInt(0)) {
    formattedAmount = wholePart.toString();
  } else {
    const fractionalStr = fractionalPart
      .toString()
      .padStart(tokenInfo.decimals, '0');

    let actualPrecision = precision;
    if (actualPrecision === undefined) {
      if (wholePart > BigInt(1000)) {
        actualPrecision = Math.min(2, tokenInfo.decimals);
      } else if (wholePart > BigInt(1)) {
        actualPrecision = Math.min(4, tokenInfo.decimals);
      } else {
        actualPrecision = Math.min(6, tokenInfo.decimals);
      }
    } else {
      actualPrecision = Math.min(precision!, tokenInfo.decimals);
    }

    const trimmedFractional = fractionalStr
      .slice(0, actualPrecision)
      .replace(/0+$/, '');

    if (trimmedFractional) {
      formattedAmount = `${wholePart}.${trimmedFractional}`;
    } else {
      formattedAmount = wholePart.toString();
    }
  }

  if (compact) {
    const num = parseFloat(formattedAmount);
    if (num >= 1_000_000) {
      formattedAmount = `${(num / 1_000_000).toFixed(2)}M`;
    } else if (num >= 1_000) {
      formattedAmount = `${(num / 1_000).toFixed(2)}K`;
    }
  }

  if (!compact && !formattedAmount.includes('.')) {
    const num = parseInt(formattedAmount);
    if (num >= 1000) {
      formattedAmount = num.toLocaleString();
    }
  }

  return showSymbol
    ? `${formattedAmount} ${tokenInfo.symbol}`
    : formattedAmount;
}

/**
 * Synchronous version of formatTokenAmount using cached data
 */
export function formatTokenAmountSync(
  value: bigint,
  tokenAddress: string,
  options: {
    showSymbol?: boolean;
    precision?: number;
    compact?: boolean;
  } = {},
): string {
  const { showSymbol = true, precision, compact = false } = options;
  const tokenInfo = getTokenInfoSync(tokenAddress);

  const divisor = BigInt(10 ** tokenInfo.decimals);
  const wholePart = value / divisor;
  const fractionalPart = value % divisor;

  let formattedAmount: string;

  if (fractionalPart === BigInt(0)) {
    formattedAmount = wholePart.toString();
  } else {
    const fractionalStr = fractionalPart
      .toString()
      .padStart(tokenInfo.decimals, '0');

    let actualPrecision = precision;
    if (actualPrecision === undefined) {
      if (wholePart > BigInt(1000)) {
        actualPrecision = Math.min(2, tokenInfo.decimals);
      } else if (wholePart > BigInt(1)) {
        actualPrecision = Math.min(4, tokenInfo.decimals);
      } else {
        actualPrecision = Math.min(6, tokenInfo.decimals);
      }
    } else {
      actualPrecision = Math.min(precision!, tokenInfo.decimals);
    }

    const trimmedFractional = fractionalStr
      .slice(0, actualPrecision)
      .replace(/0+$/, '');

    if (trimmedFractional) {
      formattedAmount = `${wholePart}.${trimmedFractional}`;
    } else {
      formattedAmount = wholePart.toString();
    }
  }

  if (compact) {
    const num = parseFloat(formattedAmount);
    if (num >= 1_000_000) {
      formattedAmount = `${(num / 1_000_000).toFixed(2)}M`;
    } else if (num >= 1_000) {
      formattedAmount = `${(num / 1_000).toFixed(2)}K`;
    }
  }

  if (!compact && !formattedAmount.includes('.')) {
    const num = parseInt(formattedAmount);
    if (num >= 1000) {
      formattedAmount = num.toLocaleString();
    }
  }

  return showSymbol
    ? `${formattedAmount} ${tokenInfo.symbol}`
    : formattedAmount;
}

export async function formatUSDValue(
  tokenAmount: bigint,
  tokenAddress: string,
  usdPrice: number,
): Promise<string> {
  const tokenInfo = await getTokenInfo(tokenAddress);
  const divisor = BigInt(10 ** tokenInfo.decimals);
  const amount = Number(tokenAmount) / Number(divisor);
  const usdValue = amount * usdPrice;

  if (usdValue < 0.01) {
    return '<$0.01';
  } else if (usdValue < 1) {
    return `$${usdValue.toFixed(3)}`;
  } else if (usdValue < 1000) {
    return `$${usdValue.toFixed(2)}`;
  } else if (usdValue < 1_000_000) {
    return `$${(usdValue / 1000).toFixed(2)}K`;
  } else {
    return `$${(usdValue / 1_000_000).toFixed(2)}M`;
  }
}

export async function getTokenSymbol(tokenAddress: string): Promise<string> {
  const tokenInfo = await getTokenInfo(tokenAddress);
  return tokenInfo.symbol;
}

/**
 * Get the display symbol for icon purposes
 */
export async function getTokenDisplaySymbol(
  tokenAddress: string,
): Promise<string> {
  const tokenInfo = await getTokenInfo(tokenAddress);
  return tokenInfo.displaySymbol;
}

/**
 * Get the display symbol for icon purposes (synchronous)
 */
export function getTokenDisplaySymbolSync(tokenAddress: string): string {
  const tokenInfo = getTokenInfoSync(tokenAddress);
  return tokenInfo.displaySymbol;
}

export { formatActivityDate } from './date-formatting';
