import type {
  ConfirmedSignatureInfo,
  Connection,
  GetVersionedTransactionConfig,
  PublicKey,
  VersionedTransactionResponse,
} from '@solana/web3.js';

type CacheEntry<T> = { value: T; at: number };

const TX_TTL_MS = 2 * 60 * 1000; // 2 minutes
const SIGS_TTL_MS = 30 * 1000; // 30 seconds

const txCache = new Map<
  string,
  CacheEntry<VersionedTransactionResponse | null>
>();
const sigsCache = new Map<string, CacheEntry<ConfirmedSignatureInfo[]>>();

function isFresh(entry: CacheEntry<unknown> | undefined, ttl: number): boolean {
  return !!entry && Date.now() - entry.at < ttl;
}

export async function cachedGetTransaction(
  connection: Connection,
  signature: string,
  options?: GetVersionedTransactionConfig,
): Promise<VersionedTransactionResponse | null> {
  const key = `${signature}`;
  const cached = txCache.get(key);
  if (isFresh(cached, TX_TTL_MS)) return cached!.value;

  const tx = await connection.getTransaction(signature, options);
  txCache.set(key, { value: tx, at: Date.now() });
  return tx;
}

export async function cachedGetSignaturesForAddress(
  connection: Connection,
  address: PublicKey,
  opts: { limit?: number; before?: string; until?: string } = {},
): Promise<ConfirmedSignatureInfo[]> {
  const key = `${address.toBase58()}::${opts.limit ?? ''}::${opts.before ?? ''}::${opts.until ?? ''}`;
  const cached = sigsCache.get(key);
  if (isFresh(cached, SIGS_TTL_MS)) return cached!.value;

  const result = await connection.getSignaturesForAddress(address, opts);
  sigsCache.set(key, { value: result, at: Date.now() });
  return result;
}
