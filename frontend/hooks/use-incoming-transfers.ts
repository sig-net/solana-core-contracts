'use client';

import { useQuery } from '@tanstack/react-query';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import type { Wallet } from '@coral-xyz/anchor';

import { queryKeys } from '@/lib/query-client';
import { BridgeContract } from '@/lib/contracts/bridge-contract';

// Removed Ethereum-based tracking; deposits are derived from Solana state only

export interface TransferEvent {
  requestId: string;
  tokenAddress: string;
  value: bigint;
  timestamp?: number;
  status: 'pending' | 'completed';
}

// We no longer fetch from Ethereum. Deposits are driven from Solana state.

// Intentionally left here for potential future use in per-transfer status checks
// function hasClaimedOnSolana(
//   bridgeContract: BridgeContract,
//   userPublicKey: PublicKey,
//   erc20Address: string,
// ): Promise<boolean> {
//   return bridgeContract
//     .fetchUserBalance(userPublicKey, erc20Address)
//     .then(balance => balance !== '0')
//     .catch(() => false);
// }

export function useIncomingTransfers() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey } = wallet;
  // No Ethereum dependency needed here anymore

  const query = useQuery({
    queryKey: publicKey
      ? queryKeys.solana.incomingDeposits(publicKey.toString())
      : [],
    queryFn: async (): Promise<TransferEvent[]> => {
      if (!publicKey) throw new Error('No public key available');

      const anchorWallet: Wallet = {
        publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
        payer: publicKey ? { publicKey } : undefined,
      } as unknown as Wallet;

      const bridgeContract = new BridgeContract(connection, anchorWallet);

      const deposits = await bridgeContract.fetchAllUserDeposits(publicKey);
      return deposits.map(d => ({
        requestId: d.requestId,
        tokenAddress: d.erc20Address,
        value: BigInt(d.amount),
        timestamp: d.timestamp,
        status: d.status,
      }));
    },
    enabled: !!publicKey,
    // Deposits history rarely changes per block; cache longer
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: true,
  });

  return query;
}
