'use client';

import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

import { queryKeys } from '@/lib/query-client';
import { WithdrawalService } from '@/lib/services/withdrawal-service';
import { VAULT_ETHEREUM_ADDRESS } from '@/lib/constants/addresses';

import { useWithdrawalService } from './use-withdrawal-service';

export interface OutgoingTransfer {
  requestId: string;
  transactionHash?: string;
  blockNumber?: bigint;
  logIndex: number;
  from: string;
  to: string;
  value: bigint;
  tokenAddress: string;
  recipient: string;
  timestamp?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface WithdrawalRequest {
  requestId: string;
  erc20Address: string;
  amount: string;
  recipient: string;
  timestamp: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  ethereumTxHash?: string;
}

async function fetchUserWithdrawals(
  publicKey: PublicKey,
  withdrawalService: WithdrawalService,
): Promise<WithdrawalRequest[]> {
  try {
    // Use the comprehensive method that fetches both pending and historical withdrawals
    const allWithdrawals =
      await withdrawalService.fetchAllUserWithdrawals(publicKey);

    // Transform to our format
    return allWithdrawals.map(withdrawal => ({
      requestId: withdrawal.requestId,
      erc20Address: withdrawal.erc20Address,
      amount: withdrawal.amount,
      recipient: withdrawal.recipient,
      timestamp: withdrawal.timestamp,
      status: withdrawal.status,
      ethereumTxHash: withdrawal.ethereumTxHash,
    }));
  } catch (error) {
    console.error('Error fetching user withdrawals:', error);
    return [];
  }
}

export function useOutgoingTransfers() {
  const { publicKey } = useWallet();
  const withdrawalService = useWithdrawalService();

  const query = useQuery({
    queryKey: publicKey
      ? queryKeys.solana.outgoingTransfers(publicKey.toString())
      : [],
    queryFn: async (): Promise<OutgoingTransfer[]> => {
      if (!publicKey) throw new Error('No public key available');

      // Fetch user's withdrawal requests from Solana
      const withdrawalRequests = await fetchUserWithdrawals(
        publicKey,
        withdrawalService,
      );

      // Transform withdrawal requests to OutgoingTransfer format
      return withdrawalRequests.map(
        (request): OutgoingTransfer => ({
          requestId: request.requestId,
          transactionHash: request.ethereumTxHash,
          blockNumber: undefined,
          logIndex: 0,
          from: VAULT_ETHEREUM_ADDRESS, // Main vault address
          to: request.recipient,
          value: BigInt(request.amount),
          tokenAddress: request.erc20Address,
          recipient: request.recipient,
          timestamp: request.timestamp,
          status: request.status,
        }),
      );
    },
    enabled: !!publicKey,
    // Outgoing updates are slower; cache aggressively
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: true,
    retry: 3,
    retryDelay: 1000,
  });

  return query;
}
