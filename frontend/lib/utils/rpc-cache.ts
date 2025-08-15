import type {
  ConfirmedSignatureInfo,
  Connection,
  GetVersionedTransactionConfig,
  PublicKey,
  VersionedTransactionResponse,
} from '@solana/web3.js';

import { getRPCManager } from './rpc-manager';

export async function cachedGetTransaction(
  connection: Connection,
  signature: string,
  options?: GetVersionedTransactionConfig,
): Promise<VersionedTransactionResponse | null> {
  const rpcManager = getRPCManager(connection);
  return rpcManager.getTransaction(signature, options);
}

export async function cachedGetSignaturesForAddress(
  connection: Connection,
  address: PublicKey,
  opts: { limit?: number; before?: string; until?: string } = {},
): Promise<ConfirmedSignatureInfo[]> {
  const rpcManager = getRPCManager(connection);
  return rpcManager.getSignaturesForAddress(address, opts);
}
