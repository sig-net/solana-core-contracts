import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { TokenBalance } from './types/token.types';
import { getTokenSymbol } from './constants/token-metadata';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convert TokenBalance data from blockchain service to Token format expected by BalanceDisplay
 */
export function convertTokenBalanceToDisplayToken(tokenBalance: TokenBalance) {
  return {
    balance: BigInt(tokenBalance.amount),
    token: getTokenSymbol(tokenBalance.erc20Address),
    chain: 'ethereum', // ERC20 tokens are on Ethereum
    decimals: tokenBalance.decimals,
    erc20Address: tokenBalance.erc20Address,
  };
}

/**
 * Convert array of TokenBalance to array of display tokens
 */
export function convertTokenBalancesToDisplayTokens(
  tokenBalances: TokenBalance[],
) {
  return tokenBalances.map(convertTokenBalanceToDisplayToken);
}

/**
 * Calculate USD value for a token amount
 */
export function calculateUsdValue(
  amount: string,
  decimals: number,
  priceUsd: number,
): number {
  const numericAmount = parseFloat(amount) / Math.pow(10, decimals);
  return numericAmount * priceUsd;
}

/**
 * Format USD value for display
 */
export function formatUsdValue(usdValue: number): string {
  if (usdValue === 0) return '$0.00';
  if (usdValue < 0.01) return '<$0.01';
  if (usdValue >= 1000000) {
    return `$${(usdValue / 1000000).toFixed(1)}M`;
  }
  if (usdValue >= 1000) {
    return `$${(usdValue / 1000).toFixed(1)}K`;
  }
  return `$${usdValue.toFixed(2)}`;
}
