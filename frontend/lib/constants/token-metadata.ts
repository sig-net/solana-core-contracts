export interface TokenMetadata {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

// Token metadata for supported ERC20 tokens
export const SUPPORTED_TOKENS: TokenMetadata[] = [
  {
    address: '0xbe72e441bf55620febc26715db68d3494213d8cb',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
];

// Create a lookup map for quick access
export const TOKEN_METADATA_MAP = new Map<string, TokenMetadata>(
  SUPPORTED_TOKENS.map(token => [token.address.toLowerCase(), token]),
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
