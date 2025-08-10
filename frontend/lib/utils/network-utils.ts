export interface NetworkInfo {
  chainId: number;
  name: string;
  shortName: string;
  explorerUrl: string;
  explorerName: string;
}

export const NETWORKS: Record<string, NetworkInfo> = {
  mainnet: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    shortName: 'mainnet',
    explorerUrl: 'https://etherscan.io',
    explorerName: 'Etherscan',
  },
  sepolia: {
    chainId: 11155111,
    name: 'Ethereum Sepolia Testnet',
    shortName: 'sepolia',
    explorerUrl: 'https://sepolia.etherscan.io',
    explorerName: 'Sepolia Etherscan',
  },
};

export function getCurrentNetwork(): NetworkInfo {
  return NETWORKS.sepolia;
}

export function getTransactionExplorerUrl(
  transactionHash: string,
  networkName?: string,
): string {
  const network = networkName ? NETWORKS[networkName] : getCurrentNetwork();

  if (!network) {
    return `${NETWORKS.sepolia.explorerUrl}/tx/${transactionHash}`;
  }

  return `${network.explorerUrl}/tx/${transactionHash}`;
}

// Minimal helper for Solana signature explorer links (Solscan)
export function getSolanaExplorerUrl(signature: string): string {
  // Default to Solscan; cluster detection can be added if needed
  return `https://solscan.io/tx/${signature}?cluster=devnet`;
}
