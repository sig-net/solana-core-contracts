export interface TokenMetadata {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chain: string;
  chainName: string;
}

// All supported tokens with complete metadata
export const ALL_TOKENS: TokenMetadata[] = [
  {
    address: '0xbe72e441bf55620febc26715db68d3494213d8cb',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    chain: 'ethereum',
    chainName: 'Ethereum Sepolia',
  },
  {
    address: '0xB4F1737Af37711e9A5890D9510c9bB60e170CB0D',
    symbol: 'DAI',
    name: 'Dai',
    decimals: 18,
    chain: 'ethereum',
    chainName: 'Ethereum Sepolia',
  },
  {
    address: '0x0625aFB445C3B6B7B929342a04A22599fd5dBB59',
    symbol: 'COW',
    name: 'Cow Protocol',
    decimals: 18,
    chain: 'ethereum',
    chainName: 'Ethereum Sepolia',
  },
];

// Legacy exports for backward compatibility
export const SUPPORTED_TOKENS = ALL_TOKENS;

// Type alias for deposit tokens
export type DepositTokenMetadata = TokenMetadata;

// Create a lookup map for quick access
export const TOKEN_METADATA_MAP = new Map<string, TokenMetadata>(
  ALL_TOKENS.map(token => [token.address.toLowerCase(), token]),
);

// Helper function to get token metadata
export function getTokenMetadata(address: string): TokenMetadata | undefined {
  return TOKEN_METADATA_MAP.get(address.toLowerCase());
}

// Helper function to get token symbol
export function getTokenSymbol(address: string): string {
  const metadata = getTokenMetadata(address);
  return metadata?.symbol || 'Unknown';
}

// Helper function to get token decimals
export function getTokenDecimals(address: string): number {
  const metadata = getTokenMetadata(address);
  return metadata?.decimals || 18; // Default to 18 decimals like ETH
}
