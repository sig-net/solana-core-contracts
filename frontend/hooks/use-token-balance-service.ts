'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useMemo } from 'react';
import { Wallet } from '@coral-xyz/anchor';

import { BridgeContract } from '@/lib/contracts/bridge-contract';
import { TokenBalanceService } from '@/lib/services/token-balance-service';

export function useTokenBalanceService() {
  const { connection } = useConnection();
  const wallet = useWallet();

  return useMemo(() => {
    const anchorWallet: Wallet = {
      publicKey: wallet.publicKey,
      signTransaction: wallet.signTransaction,
      signAllTransactions: wallet.signAllTransactions,
      payer: wallet.publicKey ? { publicKey: wallet.publicKey } : undefined,
    } as Wallet;

    const bridgeContract = new BridgeContract(connection, anchorWallet);
    return new TokenBalanceService(bridgeContract);
  }, [
    connection,
    wallet.publicKey,
    wallet.signTransaction,
    wallet.signAllTransactions,
  ]);
}
