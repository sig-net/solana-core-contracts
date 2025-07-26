export interface DepositToken {
  symbol: string;
  name: string;
  address: string;
  chain: string;
  chainName: string;
  decimals: number;
  depositAddress?: string;
}

export const DEPOSIT_TOKENS: DepositToken[] = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0xbe72e441bf55620febc26715db68d3494213d8cb',
    chain: 'ethereum',
    chainName: 'Ethereum Sepolia',
    decimals: 6,
  },
];
