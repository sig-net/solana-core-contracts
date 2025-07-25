// Network configuration and utilities

export interface NetworkInfo {
  chainId: number;
  name: string;
  shortName: string;
  explorerUrl: string;
  explorerName: string;
}

// Supported networks
export const NETWORKS: Record<string, NetworkInfo> = {
  // Ethereum networks
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

// Get current network info (for now, hardcoded to Sepolia)
export function getCurrentNetwork(): NetworkInfo {
  // TODO: This could be dynamic based on environment or user selection
  return NETWORKS.sepolia;
}

// Get explorer URL for a transaction
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

// Get explorer URL for an address
export function getAddressExplorerUrl(
  address: string,
  networkName?: string,
): string {
  const network = networkName ? NETWORKS[networkName] : getCurrentNetwork();

  if (!network) {
    return `${NETWORKS.sepolia.explorerUrl}/address/${address}`;
  }

  return `${network.explorerUrl}/address/${address}`;
}
