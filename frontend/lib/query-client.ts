import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      gcTime: 1000 * 60 * 5, // 5 minutes
      retry: (failureCount, error) => {
        // Don't retry on wallet errors
        if (error instanceof Error && error.message.includes('wallet')) {
          return false;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

export const queryKeys = {
  solana: {
    all: ['solana'] as const,
    depositAddress: (publicKey: string) =>
      [...queryKeys.solana.all, 'depositAddress', publicKey] as const,
    userBalances: (publicKey: string) =>
      [...queryKeys.solana.all, 'userBalances', publicKey] as const,
    unclaimedBalances: (publicKey: string) =>
      [...queryKeys.solana.all, 'unclaimedBalances', publicKey] as const,
    outgoingTransfers: (publicKey: string) =>
      [...queryKeys.solana.all, 'outgoingTransfers', publicKey] as const,
    incomingDeposits: (publicKey: string) =>
      [...queryKeys.solana.all, 'incomingDeposits', publicKey] as const,
  },
  ethereum: {
    all: ['ethereum'] as const,
    incomingTransfers: (depositAddress: string) =>
      [...queryKeys.ethereum.all, 'incomingTransfers', depositAddress] as const,
  },
} as const;
