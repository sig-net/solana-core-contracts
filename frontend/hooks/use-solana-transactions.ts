'use client';

import { useQuery } from '@tanstack/react-query';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, type VersionedTransactionResponse } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

import { queryKeys } from '@/lib/query-client';
import {
  cachedGetSignaturesForAddress,
  cachedGetTransaction,
} from '@/lib/utils/rpc-cache';
import { getAllNetworks } from '@/lib/constants/token-metadata';

type Direction = 'in' | 'out';

export interface SolanaWalletTransactionItem {
  id: string; // signature + mint
  signature: string;
  timestamp: number; // seconds
  direction: Direction;
  symbol: string; // e.g., USDC
  decimals: number; // token decimals for SPL
  amount: bigint; // absolute amount in base units
  mint?: string; // SPL mint
}

function extractUserSolDelta(
  tx: VersionedTransactionResponse,
  userAddress: string,
): bigint {
  try {
    const accountKeys = tx.transaction.message.staticAccountKeys;
    const userIndex = accountKeys.findIndex(k => k.toBase58() === userAddress);
    if (userIndex === -1) return BigInt(0);
    const pre = BigInt(tx.meta?.preBalances?.[userIndex] ?? 0);
    const post = BigInt(tx.meta?.postBalances?.[userIndex] ?? 0);
    return post - pre; // positive = received, negative = sent
  } catch {
    return BigInt(0);
  }
}

export function useSolanaTransactions(limit = 25) {
  const { connection } = useConnection();
  const { publicKey } = useWallet();

  return useQuery({
    queryKey: publicKey
      ? [
          ...queryKeys.solana.all,
          'walletTransactions',
          publicKey.toString(),
          limit,
        ]
      : [],
    enabled: !!publicKey,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
    queryFn: async (): Promise<SolanaWalletTransactionItem[]> => {
      if (!publicKey) throw new Error('No public key available');

      const userAddress = publicKey.toBase58();

      // Build list of addresses to scan: wallet + ATAs for known SPL mints
      const solanaNetwork = getAllNetworks().find(n => n.chain === 'solana');
      const mints: PublicKey[] = (solanaNetwork?.tokens ?? []).map(
        t => new PublicKey(t.address),
      );
      const ataAddresses = await Promise.all(
        mints.map(mint => getAssociatedTokenAddress(mint, publicKey, true)),
      );
      const addressesToScan: PublicKey[] = [publicKey, ...ataAddresses];

      const scanLimit = Number.isFinite(limit)
        ? Math.max(1, Number(limit))
        : 25;
      const signaturesArrays = await Promise.all(
        addressesToScan.map(addr =>
          cachedGetSignaturesForAddress(connection, addr, { limit: scanLimit }),
        ),
      );

      // Deduplicate signatures across wallet and ATAs
      const signatureToTime = new Map<string, number | undefined>();
      for (const arr of signaturesArrays) {
        for (const s of arr) {
          if (!signatureToTime.has(s.signature)) {
            signatureToTime.set(s.signature, s.blockTime ?? undefined);
          }
        }
      }

      const uniqueSignatures = Array.from(signatureToTime.keys());
      if (uniqueSignatures.length === 0) return [];

      const txs = await Promise.all(
        uniqueSignatures.map(sig =>
          cachedGetTransaction(connection, sig, {
            maxSupportedTransactionVersion: 0,
          }),
        ),
      );

      // Prepare Solana token metadata map for quick lookup (by mint address)
      const solanaNetwork2 = getAllNetworks().find(n => n.chain === 'solana');
      const mintToMeta = new Map<
        string,
        { symbol: string; decimals: number }
      >();
      if (solanaNetwork2) {
        for (const t of solanaNetwork2.tokens) {
          mintToMeta.set(t.address, { symbol: t.symbol, decimals: t.decimals });
        }
      }

      const items: SolanaWalletTransactionItem[] = [];

      for (let i = 0; i < txs.length; i++) {
        const tx = txs[i];
        const signature = uniqueSignatures[i];
        if (!tx || !tx.meta) continue;

        const timestamp =
          signatureToTime.get(signature) || Math.floor(Date.now() / 1000);

        // SPL token deltas for accounts owned by the user
        const preByMint = new Map<string, bigint>();
        const postByMint = new Map<string, bigint>();
        const decimalsByMint = new Map<string, number>();

        for (const b of tx.meta.preTokenBalances || []) {
          if (b.owner === userAddress) {
            const amt = BigInt(b.uiTokenAmount?.amount ?? '0');
            preByMint.set(b.mint, (preByMint.get(b.mint) ?? BigInt(0)) + amt);
            if (typeof b.uiTokenAmount?.decimals === 'number') {
              decimalsByMint.set(b.mint, b.uiTokenAmount.decimals);
            }
          }
        }
        for (const b of tx.meta.postTokenBalances || []) {
          if (b.owner === userAddress) {
            const amt = BigInt(b.uiTokenAmount?.amount ?? '0');
            postByMint.set(b.mint, (postByMint.get(b.mint) ?? BigInt(0)) + amt);
            if (typeof b.uiTokenAmount?.decimals === 'number') {
              decimalsByMint.set(b.mint, b.uiTokenAmount.decimals);
            }
          }
        }

        const mints = new Set<string>([
          ...preByMint.keys(),
          ...postByMint.keys(),
        ]);
        for (const mint of mints) {
          const pre = preByMint.get(mint) ?? BigInt(0);
          const post = postByMint.get(mint) ?? BigInt(0);
          const delta = post - pre;
          if (delta === BigInt(0)) continue;

          // Resolve symbol/decimals with fallbacks
          const meta = mintToMeta.get(mint);
          const decimals = decimalsByMint.get(mint) ?? meta?.decimals ?? 6;
          const symbol = meta?.symbol ?? 'SPL';

          items.push({
            id: `${signature}-${mint}`,
            signature,
            timestamp,
            direction: delta > BigInt(0) ? 'in' : 'out',
            symbol,
            decimals,
            amount: delta > BigInt(0) ? delta : -delta,
            mint,
          });
        }
      }

      // Sort by timestamp desc
      items.sort((a, b) => b.timestamp - a.timestamp);
      return items;
    },
  });
}
