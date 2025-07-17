'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';

import { queryKeys } from '@/lib/query-client';
import { useSolanaService } from './use-solana-service';

export function useWithdrawMutation() {
  const { publicKey } = useWallet();
  const solanaService = useSolanaService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      erc20Address,
      amount,
      recipientAddress,
      onStatusChange,
    }: {
      erc20Address: string;
      amount: string;
      recipientAddress: string;
      onStatusChange?: (status: {
        status: string;
        txHash?: string;
        note?: string;
        error?: string;
      }) => void;
    }) => {
      if (!publicKey) throw new Error('No public key available');
      return solanaService.withdraw(
        publicKey,
        erc20Address,
        amount,
        recipientAddress,
        onStatusChange,
      );
    },
    onSuccess: () => {
      if (publicKey) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.solana.userBalances(publicKey.toString()),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.solana.unclaimedBalances(publicKey.toString()),
        });
      }
    },
    onError: error => {
      console.error('Withdraw mutation failed:', error);
    },
  });
}