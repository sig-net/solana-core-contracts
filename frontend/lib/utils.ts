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

