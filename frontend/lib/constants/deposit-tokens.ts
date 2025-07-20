export interface DepositToken {
  symbol: string;
  name: string;
  address: string;
  chain: string;
  chainName: string;
  decimals: number;
  depositAddress?: string; // Will be generated/fetched per user
}

// Supported tokens for deposit
export const DEPOSIT_TOKENS: DepositToken[] = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0xbe72e441bf55620febc26715db68d3494213d8cb',
    chain: 'ethereum',
    chainName: 'Ethereum Sepolia',
    decimals: 6,
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    address: 'So11111111111111111111111111111111111111112', // Wrapped SOL
    chain: 'solana',
    chainName: 'Solana Devnet',
    decimals: 9,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC on Solana
    chain: 'solana',
    chainName: 'Solana Devnet',
    decimals: 6,
  },
];

// Helper function to get tokens by chain
export function getTokensByChain(chain: string): DepositToken[] {
  return DEPOSIT_TOKENS.filter(token => token.chain === chain);
}

// Helper function to get unique chains
export function getSupportedChains(): string[] {
  return Array.from(new Set(DEPOSIT_TOKENS.map(token => token.chain)));
}
