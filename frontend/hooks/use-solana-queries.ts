'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useMemo } from 'react';
import { Wallet } from '@coral-xyz/anchor';

import { SolanaService } from '@/lib/solana-service';
import { queryKeys } from '@/lib/query-client';

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

export function useDepositAddress() {
  const { publicKey } = useWallet();
  const solanaService = useSolanaService();

  return useQuery({
    queryKey: publicKey
      ? queryKeys.solana.depositAddress(publicKey.toString())
      : [],
    queryFn: () => {
      if (!publicKey) throw new Error('No public key available');
      return solanaService.deriveDepositAddress(publicKey);
    },
    enabled: !!publicKey,
  });
}

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
    refetchInterval: 5000,
  });
}

export function useDepositErc20Mutation() {
  const { publicKey } = useWallet();
  const solanaService = useSolanaService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      erc20Address,
      amount,
      decimals,
      onStatusChange,
    }: {
      erc20Address: string;
      amount: string;
      decimals: number;
      onStatusChange?: (status: {
        status: string;
        txHash?: string;
        note?: string;
        error?: string;
      }) => void;
    }) => {
      if (!publicKey) throw new Error('No public key available');
      return solanaService.depositErc20(
        publicKey,
        erc20Address,
        amount,
        decimals,
        onStatusChange,
      );
    },
    onSuccess: () => {
      if (publicKey) {
      }
    },
    onError: error => {
      console.error('Deposit ERC20 mutation failed:', error);
    },
  });
}

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
      }
    },
    onError: error => {
      console.error('Claim ERC20 mutation failed:', error);
    },
  });
}

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
      }
    },
    onError: error => {
      console.error('Withdraw mutation failed:', error);
    },
  });
}
