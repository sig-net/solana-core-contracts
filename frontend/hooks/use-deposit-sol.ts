'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useMemo } from 'react';

// For Solana deposits, user sends directly to their own wallet. This hook exposes the target address.
export function useDepositSol() {
  const { publicKey } = useWallet();

  return useMemo(() => {
    return {
      depositAddress: publicKey?.toString() ?? '',
      canDeposit: !!publicKey,
    };
  }, [publicKey]);
}
