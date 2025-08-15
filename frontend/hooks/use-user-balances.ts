'use client';

import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';

import { queryKeys } from '@/lib/query-client';

import { useTokenBalanceService } from './use-token-balance-service';

export function useUserBalances() {
  const { publicKey } = useWallet();
  const tokenBalanceService = useTokenBalanceService();

  return useQuery({
    queryKey: publicKey
      ? queryKeys.solana.userBalances(publicKey.toString())
      : [],
    queryFn: () => {
      if (!publicKey) throw new Error('No public key available');
      return tokenBalanceService.fetchUserBalances(publicKey);
    },
    enabled: !!publicKey,
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
    refetchIntervalInBackground: true,
  });
}
