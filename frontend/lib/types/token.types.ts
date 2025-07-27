// Base token information
export interface BaseToken {
  erc20Address: string;
  decimals: number;
  symbol?: string;
  name?: string;
}

// Token balance with amount
export interface TokenBalance extends BaseToken {
  amount: string;
}

// Unclaimed token balance (includes required symbol and name)
export interface UnclaimedTokenBalance extends TokenBalance {
  symbol: string;
  name: string;
}

// Token decimal information with cache metadata
export interface TokenDecimalInfo {
  decimals: number;
  symbol?: string;
  timestamp: number;
}
