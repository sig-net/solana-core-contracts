export interface TokenMetadata {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

export interface NetworkData {
  chain: string;
  chainName: string;
  symbol: string;
  color: string;
  tokens: TokenMetadata[];
}

// Network-first organization matching Figma design
export const NETWORKS_WITH_TOKENS: NetworkData[] = [
  {
    chain: 'ethereum',
    chainName: 'Ethereum',
    symbol: 'ethereum',
    color: '#000000',
    tokens: [
      {
        address: '0xbe72e441bf55620febc26715db68d3494213d8cb',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
      },
      {
        address: '0xB4F1737Af37711e9A5890D9510c9bB60e170CB0D',
        symbol: 'DAI',
        name: 'Dai',
        decimals: 18,
      },
      {
        address: '0x0625aFB445C3B6B7B929342a04A22599fd5dBB59',
        symbol: 'COW',
        name: 'Cow Protocol',
        decimals: 18,
      },
    ],
  },
  {
    chain: 'solana',
    chainName: 'Solana',
    symbol: 'solana',
    color: '#9945FF',
    tokens: [
      {
        address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        symbol: 'USDT',
        name: 'Tether',
        decimals: 6,
      },
      {
        address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
      },
    ],
  },
];

// Legacy interface for backward compatibility
// Flattened ERC20 token interface (with chain context)
export interface Erc20TokenMetadata extends TokenMetadata {
  chain: string;
  chainName: string;
}

// Utility functions derived from the single source of truth (NETWORKS_WITH_TOKENS)
export function getErc20Networks(): NetworkData[] {
  // We don't include native tokens in NETWORKS_WITH_TOKENS, so just filter networks
  return NETWORKS_WITH_TOKENS.filter(network => network.chain === 'ethereum');
}

export function getAllErc20Tokens(): Erc20TokenMetadata[] {
  return getErc20Networks().flatMap(network =>
    network.tokens.map(token => ({
      ...token,
      chain: network.chain,
      chainName: network.chainName,
    })),
  );
}

export function getAllErc20Addresses(): string[] {
  return getAllErc20Tokens().map(t => t.address);
}

// Create a lookup map for quick access
export const TOKEN_METADATA_MAP = new Map<string, Erc20TokenMetadata>(
  getAllErc20Tokens().map(token => [token.address.toLowerCase(), token]),
);

// Helper function to get token metadata
export function getTokenMetadata(
  address: string,
): Erc20TokenMetadata | undefined {
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
