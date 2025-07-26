import {
  createPublicClient,
  createWalletClient,
  http,
  PublicClient,
  WalletClient,
} from 'viem';
import { sepolia } from 'viem/chains';

/**
 * Get Sepolia RPC URL using Alchemy
 */
function getSepoliaRpcUrl(): string {
  const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  const customRpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;

  if (customRpcUrl) {
    return customRpcUrl;
  }

  // TODO: This should be generic for any EVM chain
  if (alchemyApiKey) {
    return `https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`;
  }

  throw new Error(
    'Either NEXT_PUBLIC_ALCHEMY_API_KEY or NEXT_PUBLIC_SEPOLIA_RPC_URL must be set',
  );
}

/**
 * Get public client for reading blockchain data
 */
export function getPublicClient(): PublicClient {
  return createPublicClient({
    chain: sepolia,
    transport: http(getSepoliaRpcUrl()),
  });
}

/**
 * Get wallet client for transactions (requires user wallet connection)
 */
export function getWalletClient(): WalletClient {
  return createWalletClient({
    chain: sepolia,
    transport: http(getSepoliaRpcUrl()),
  });
}

/**
 * Get automated provider (read-only, no private key needed)
 */
export function getAutomatedProvider(): PublicClient {
  return getPublicClient();
}
