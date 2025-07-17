'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useMemo } from 'react';
import { Wallet } from '@coral-xyz/anchor';

import { SolanaService } from '@/lib/solana-service';

export function useSolanaService() {
  const { connection } = useConnection();
  const wallet = useWallet();

  return useMemo(() => {
    const anchorWallet: Wallet = {
      publicKey: wallet.publicKey,
      signTransaction: wallet.signTransaction,
      signAllTransactions: wallet.signAllTransactions,
      payer: wallet.publicKey ? { publicKey: wallet.publicKey } : undefined,
    } as Wallet;

    const service = new SolanaService(connection, anchorWallet);
    return service;
  }, [
    connection,
    wallet.publicKey,
    wallet.signTransaction,
    wallet.signAllTransactions,
  ]);
}
