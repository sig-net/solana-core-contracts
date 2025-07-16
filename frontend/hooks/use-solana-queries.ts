'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useMemo } from 'react';

import { SolanaService } from '@/lib/solana-service';
import { queryKeys } from '@/lib/query-client';

export function useSolanaService() {
  const { connection } = useConnection();
  const wallet = useWallet();

  return useMemo(() => {
    const service = new SolanaService(connection, wallet);
    return service;
  }, [connection, wallet]);
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
  });
}

export function usePendingDeposits() {
  const { publicKey } = useWallet();
  const solanaService = useSolanaService();

  return useQuery({
    queryKey: publicKey
      ? queryKeys.solana.pendingDeposits(publicKey.toString())
      : [],
    queryFn: () => {
      if (!publicKey) throw new Error('No public key available');
      return solanaService.fetchPendingDeposits(publicKey);
    },
    enabled: !!publicKey,
    refetchInterval: 1000,
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
    }: {
      erc20Address: string;
      amount: string;
      decimals: number;
    }) => {
      if (!publicKey) throw new Error('No public key available');
      return solanaService.depositErc20(
        publicKey,
        erc20Address,
        amount,
        decimals,
      );
    },
    onSuccess: () => {
      if (publicKey) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.solana.pendingDeposits(publicKey.toString()),
        });
      }
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
        queryClient.invalidateQueries({
          queryKey: queryKeys.solana.pendingDeposits(publicKey.toString()),
        });
      }
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
    }: {
      erc20Address: string;
      amount: string;
    }) => {
      if (!publicKey) throw new Error('No public key available');
      return solanaService.withdraw(publicKey, erc20Address, amount);
    },
    onSuccess: () => {
      if (publicKey) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.solana.userBalances(publicKey.toString()),
        });
      }
    },
  });
}

export function useSubmitSignedTransactionMutation() {
  const { publicKey } = useWallet();
  const solanaService = useSolanaService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId }: { requestId: string }) => {
      if (!solanaService) {
        throw new Error('Service not available');
      }
      return await solanaService.submitSignedTransactionFromPrevious(requestId);
    },
    onSuccess: () => {
      if (publicKey) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.solana.pendingDeposits(publicKey.toString()),
        });
      }
    },
  });
}
