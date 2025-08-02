'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useMemo } from 'react';
import { Wallet } from '@coral-xyz/anchor';

import { BridgeContract } from '@/lib/contracts/bridge-contract';
import { TokenBalanceService } from '@/lib/services/token-balance-service';
import { WithdrawalService } from '@/lib/services/withdrawal-service';

export function useWithdrawalServiceDirect() {
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
    const tokenBalanceService = new TokenBalanceService(bridgeContract);
    return new WithdrawalService(bridgeContract, tokenBalanceService);
  }, [
    connection,
    wallet.publicKey,
    wallet.signTransaction,
    wallet.signAllTransactions,
  ]);
}
