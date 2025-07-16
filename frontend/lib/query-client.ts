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
  },
} as const;
