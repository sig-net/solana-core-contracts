import { getSepoliaRpcUrl as getSepoliaRpcUrlFromEnv } from './env';

/**
 * Get Sepolia RPC URL
 * @deprecated Use getSepoliaRpcUrl from @/lib/utils/env instead
 */
export function getSepoliaRpcUrl(): string {
  return getSepoliaRpcUrlFromEnv();
}
