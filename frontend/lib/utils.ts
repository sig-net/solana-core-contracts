import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { TokenBalance, TokenWithBalance } from './types/token.types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convert TokenBalance data from blockchain service to TokenWithBalance format expected by BalanceDisplay
 */
export function convertTokenBalanceToDisplayToken(
  tokenBalance: TokenBalance,
): TokenWithBalance {
  return {
    erc20Address: tokenBalance.erc20Address,
    symbol: tokenBalance.symbol,
    name: tokenBalance.name,
    decimals: tokenBalance.decimals,
    chain: tokenBalance.chain,
    balance: BigInt(tokenBalance.amount),
  };
}

/**
 * Convert array of TokenBalance to array of TokenWithBalance for display
 */
export function convertTokenBalancesToDisplayTokens(
  tokenBalances: TokenBalance[],
): TokenWithBalance[] {
  return tokenBalances.map(convertTokenBalanceToDisplayToken);
}
