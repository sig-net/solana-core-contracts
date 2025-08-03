import { ethers } from 'ethers';
import { Connection } from '@solana/web3.js';
import { Alchemy, Network } from 'alchemy-sdk';

import { getClientEnv, getSepoliaRpcUrl, getSolanaRpcUrl } from './env';

export type SupportedChain = 'ethereum-sepolia' | 'solana';

// Provider cache to avoid creating multiple instances
const providerCache = new Map<
  string,
  ethers.JsonRpcProvider | Connection | Alchemy
>();

/**
 * Get Ethereum Sepolia provider (ethers JsonRpcProvider)
 * Uses Alchemy API with fallback to custom RPC URL
 */
export function getEthereumProvider(): ethers.JsonRpcProvider {
  const cacheKey = 'ethereum-sepolia';

  if (providerCache.has(cacheKey)) {
    return providerCache.get(cacheKey);
  }

  const rpcUrl = getSepoliaRpcUrl();
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  providerCache.set(cacheKey, provider);
  return provider;
}

/**
 * Get Solana connection
 */
export function getSolanaConnection(): Connection {
  const cacheKey = 'solana';

  if (providerCache.has(cacheKey)) {
    return providerCache.get(cacheKey);
  }

  const rpcUrl = getSolanaRpcUrl();
  const connection = new Connection(rpcUrl);

  providerCache.set(cacheKey, connection);
  return connection;
}

/**
 * Get Alchemy SDK instance
 */
export function getAlchemyProvider(): Alchemy {
  const cacheKey = 'alchemy-sdk';

  if (providerCache.has(cacheKey)) {
    return providerCache.get(cacheKey);
  }

  const env = getClientEnv();
  const alchemy = new Alchemy({
    apiKey: env.NEXT_PUBLIC_ALCHEMY_API_KEY,
    network: Network.ETH_SEPOLIA,
  });

  providerCache.set(cacheKey, alchemy);
  return alchemy;
}

/**
 * Universal provider factory
 * Returns the appropriate provider for the specified chain
 */
export function getProvider(chain: SupportedChain) {
  switch (chain) {
    case 'ethereum-sepolia':
      return getEthereumProvider();
    case 'solana':
      return getSolanaConnection();
    default:
      throw new Error(`Unsupported chain: ${chain}`);
  }
}

/**
 * Get provider for smart contract interactions
 * Returns Alchemy SDK for contract calls, ethers provider for transactions
 */
export function getContractProvider(useAlchemy = true) {
  return useAlchemy ? getAlchemyProvider() : getEthereumProvider();
}

/**
 * Clear provider cache (useful for testing or configuration changes)
 */
export function clearProviderCache(): void {
  providerCache.clear();
}
