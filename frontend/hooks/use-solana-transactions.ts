'use client';

/**
 * Hook to fetch Solana wallet transactions for the Activity table
 * NOTE: This only tracks SPL token transfers, not native SOL transfers
 * Native SOL transfers are intentionally excluded from the Activity table
 */

import { useQuery } from '@tanstack/react-query';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

import { queryKeys } from '@/lib/query-client';
import { getRPCManager } from '@/lib/utils/rpc-manager';
import { getAllNetworks } from '@/lib/constants/token-metadata';

type Direction = 'in' | 'out';

export interface SolanaWalletTransactionItem {
  id: string;
  signature: string;
  timestamp: number;
  direction: Direction;
  symbol: string;
  decimals: number;
  amount: bigint;
  mint?: string;
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

    staleTime: 3 * 1000, // 3 seconds
    gcTime: 30 * 60_000,
    refetchInterval: 5 * 1000, // Refetch every 5 seconds
    refetchIntervalInBackground: true,
    queryFn: async (): Promise<SolanaWalletTransactionItem[]> => {
      if (!publicKey) throw new Error('No public key available');

      const rpcManager = getRPCManager(connection);
      const userAddress = publicKey.toBase58();

      const solanaNetwork = getAllNetworks().find(n => n.chain === 'solana');
      const mints: PublicKey[] = (solanaNetwork?.tokens ?? []).map(
        t => new PublicKey(t.address),
      );

      const scanLimit = Number.isFinite(limit)
        ? Math.max(1, Math.min(Number(limit), 50))
        : 25;

      const walletSignatures = await rpcManager.getSignaturesForAddress(
        publicKey,
        { limit: scanLimit },
      );

      if (walletSignatures.length === 0) return [];

      const needMoreTransactions = walletSignatures.length < scanLimit / 2;
      const ataSignatures: Array<{
        signature: string;
        blockTime?: number | null;
      }> = [];

      if (needMoreTransactions && mints.length > 0) {
        const ataAddresses = await Promise.all(
          mints.map(mint => getAssociatedTokenAddress(mint, publicKey, true)),
        );

        const ataLimit = Math.max(1, Math.floor(scanLimit / mints.length));

        for (const ata of ataAddresses) {
          try {
            const sigs = await rpcManager.getSignaturesForAddress(ata, {
              limit: ataLimit,
            });
            ataSignatures.push(...sigs);

            if (walletSignatures.length + ataSignatures.length >= scanLimit) {
              break;
            }
          } catch (error) {
            console.warn(
              `Failed to fetch signatures for ATA ${ata.toBase58()}:`,
              error,
            );
          }
        }
      }

      const signatureToTime = new Map<string, number | undefined>();

      for (const s of walletSignatures) {
        signatureToTime.set(s.signature, s.blockTime ?? undefined);
      }

      for (const s of ataSignatures) {
        if (!signatureToTime.has(s.signature)) {
          signatureToTime.set(s.signature, s.blockTime ?? undefined);
        }
      }

      const uniqueSignatures = Array.from(signatureToTime.keys()).slice(
        0,
        scanLimit,
      );
      if (uniqueSignatures.length === 0) return [];

      const transactions = await Promise.all(
        uniqueSignatures.map(sig =>
          rpcManager.getTransaction(sig, {
            maxSupportedTransactionVersion: 0,
          }),
        ),
      );

      const mintToMeta = new Map<
        string,
        { symbol: string; decimals: number }
      >();
      if (solanaNetwork) {
        for (const t of solanaNetwork.tokens) {
          mintToMeta.set(t.address, { symbol: t.symbol, decimals: t.decimals });
        }
      }

      const items: SolanaWalletTransactionItem[] = [];

      for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i];
        const signature = uniqueSignatures[i];
        if (!tx || !tx.meta) continue;

        const timestamp =
          signatureToTime.get(signature) || Math.floor(Date.now() / 1000);

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

        const mintSet = new Set<string>([
          ...preByMint.keys(),
          ...postByMint.keys(),
        ]);

        for (const mint of mintSet) {
          const pre = preByMint.get(mint) ?? BigInt(0);
          const post = postByMint.get(mint) ?? BigInt(0);
          const delta = post - pre;
          if (delta === BigInt(0)) continue;

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

      items.sort((a, b) => b.timestamp - a.timestamp);
      return items.slice(0, scanLimit);
    },
  });
}
