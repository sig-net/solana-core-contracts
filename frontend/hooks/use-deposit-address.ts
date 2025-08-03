'use client';

import { useQuery } from '@tanstack/react-query';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useMemo } from 'react';
import { Wallet } from '@coral-xyz/anchor';

import { queryKeys } from '@/lib/query-client';
import { BridgeContract } from '@/lib/contracts/bridge-contract';

export function useDepositAddress() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey } = wallet;

  const bridgeContract = useMemo(() => {
    if (!publicKey) return null;

    const anchorWallet: Wallet = {
      publicKey,
      signTransaction: wallet.signTransaction,
      signAllTransactions: wallet.signAllTransactions,
      payer: { publicKey },
    } as Wallet;

    return new BridgeContract(connection, anchorWallet);
  }, [
    connection,
    publicKey,
    wallet.signTransaction,
    wallet.signAllTransactions,
  ]);

  return useQuery({
    queryKey: publicKey
      ? queryKeys.solana.depositAddress(publicKey.toString())
      : [],
    queryFn: () => {
      if (!publicKey || !bridgeContract)
        throw new Error('No public key or bridge contract available');
      return bridgeContract.deriveDepositAddress(publicKey);
    },
    enabled: !!publicKey && !!bridgeContract,
  });
}
