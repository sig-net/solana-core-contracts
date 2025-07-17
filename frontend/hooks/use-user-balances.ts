'use client';

import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';

import { queryKeys } from '@/lib/query-client';
import { useSolanaService } from './use-solana-service';

export function useUserBalances() {
  const { publicKey } = useWallet();
  const solanaService = useSolanaService();

  return useQuery({
    queryKey: publicKey
      ? queryKeys.solana.userBalances(publicKey.toString())
      : [],
    queryFn: () => {
      if (!publicKey) throw new Error('No public key available');
      return solanaService.fetchUserBalances(publicKey);
    },
    enabled: !!publicKey,
    refetchInterval: 1000,
  });
}
