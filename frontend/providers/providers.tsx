'use client';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useMemo } from 'react';

import { wagmiConfig } from '@/lib/wagmi/config';
import { queryClient } from '@/lib/query-client';

import '@solana/wallet-adapter-react-ui/styles.css';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  // Use Alchemy as the primary RPC endpoint with custom config
  const endpoint = useMemo(() => {
    return `https://solana-devnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`;
  }, []);

  // Custom connection config to handle WebSocket issues better
  const connectionConfig = useMemo(
    () => ({
      commitment: 'confirmed' as const,
      // Disable WebSocket if having issues
      disableRetryOnRateLimit: false,
      // Use HTTP for confirmations instead of WebSocket
      confirmTransactionInitialTimeout: 60000, // 60 seconds
    }),
    [],
  );

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <ConnectionProvider endpoint={endpoint} config={connectionConfig}>
          <WalletProvider wallets={wallets} autoConnect>
            <WalletModalProvider>{children}</WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>
      </WagmiProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
