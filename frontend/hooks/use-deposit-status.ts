import { useQuery } from '@tanstack/react-query';
import { useSolanaService } from '@/hooks/use-solana-queries';

export function useDepositStatus(requestId: string | null) {
  const solanaService = useSolanaService();

  return useQuery({
    queryKey: ['depositStatus', requestId],
    queryFn: async () => {
      if (!requestId || !solanaService) {
        throw new Error('Missing required parameters');
      }
      return await solanaService.checkDepositStatus(requestId);
    },
    enabled: !!requestId && !!solanaService,
    refetchInterval: (data) => {
      // Poll every 2 seconds if not ready
      if (!data?.isReady) {
        return 2000;
      }
      // Stop polling once ready
      return false;
    },
    // Ensure fresh data
    staleTime: 0,
    gcTime: 0,
  });
}