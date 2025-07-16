import {
  createPublicClient,
  createWalletClient,
  http,
  PublicClient,
  WalletClient,
} from 'viem';
import { sepolia } from 'viem/chains';

/**
 * Get public client for reading blockchain data
 */
export function getPublicClient(): PublicClient {
  return createPublicClient({
    chain: sepolia,
    transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
  });
}

/**
 * Get wallet client for transactions (requires user wallet connection)
 */
export function getWalletClient(): WalletClient {
  return createWalletClient({
    chain: sepolia,
    transport: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
  });
}

/**
 * Get automated provider (read-only, no private key needed)
 */
export function getAutomatedProvider(): PublicClient {
  return getPublicClient();
}
