export interface TokenBalance {
  erc20Address: string;
  amount: string;
  decimals: number;
}

export interface UnclaimedTokenBalance {
  erc20Address: string;
  amount: string;
  symbol: string;
  name: string;
  decimals: number;
}
