'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';

import { queryKeys } from '@/lib/query-client';
import { useSolanaService } from './use-solana-service';

export function useClaimErc20Mutation() {
  const { publicKey } = useWallet();
  const solanaService = useSolanaService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId }: { requestId: string }) => {
      if (!publicKey) throw new Error('No public key available');
      return solanaService.claimErc20(publicKey, requestId);
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
      console.error('Claim ERC20 mutation failed:', error);
    },
  });
}