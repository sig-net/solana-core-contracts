import { createPublicClient, http, PublicClient } from 'viem';
import { sepolia } from 'viem/chains';

import { getSepoliaRpcUrl } from '@/lib/utils/rpc-utils';

/**
 * Get public client for reading blockchain data
 */
export function getPublicClient(): PublicClient {
  return createPublicClient({
    chain: sepolia,
    transport: http(getSepoliaRpcUrl()),
  });
}


