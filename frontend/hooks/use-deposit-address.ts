'use client';

import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';

import { queryKeys } from '@/lib/query-client';
import { deriveDepositAddress } from '@/lib/constants/addresses';

export function useDepositAddress() {
  const { publicKey } = useWallet();

  return useQuery({
    queryKey: publicKey
      ? queryKeys.solana.depositAddress(publicKey.toString())
      : [],
    queryFn: () => {
      if (!publicKey) throw new Error('No public key available');
      return deriveDepositAddress(publicKey);
    },
    enabled: !!publicKey,
  });
}
