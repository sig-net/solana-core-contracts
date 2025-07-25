import { ERC20_ADDRESSES } from '@/lib/constants/ethereum.constants';

export interface TokenInfo {
  symbol: string;
  decimals: number;
  name: string;
}

// Token information mapping
export const TOKEN_INFO: Record<string, TokenInfo> = {
  [ERC20_ADDRESSES.USDC_SEPOLIA_2.toLowerCase()]: {
    symbol: 'USDC',
    decimals: 6,
    name: 'USD Coin (Sepolia)',
  },
};

export function getTokenInfo(tokenAddress: string): TokenInfo {
  const info = TOKEN_INFO[tokenAddress.toLowerCase()];
  if (info) return info;

  return {
    symbol: 'ERC20',
    decimals: 18,
    name: 'Unknown Token',
  };
}

export function formatTokenAmount(
  value: bigint,
  tokenAddress: string,
  options: {
    showSymbol?: boolean;
    precision?: number;
    compact?: boolean;
  } = {},
): string {
  const { showSymbol = true, precision, compact = false } = options;
  const tokenInfo = getTokenInfo(tokenAddress);

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

export function formatUSDValue(
  tokenAmount: bigint,
  tokenAddress: string,
  usdPrice: number,
): string {
  const tokenInfo = getTokenInfo(tokenAddress);
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

export function getTokenSymbol(tokenAddress: string): string {
  return getTokenInfo(tokenAddress).symbol;
}

export { formatActivityDate } from './date-formatting';
