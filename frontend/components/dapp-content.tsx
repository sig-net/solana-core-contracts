'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { ArrowUpCircle, RefreshCw, Info } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { IconCard } from '@/components/ui/icon-card';
import { AddressDisplay } from '@/components/ui/address-display';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { Badge } from '@/components/ui/badge';
import { CopyButton } from '@/components/ui/copy-button';
import { WelcomeScreen } from '@/components/welcome-screen';
import { BalanceTable } from '@/components/balance-table';
import { DepositFlow } from '@/components/deposit-flow';
import { UnclaimedBalances } from '@/components/unclaimed-balances';
import {
  useDepositAddress,
  useUserBalances,
  useWithdrawMutation,
  useUnclaimedBalances,
} from '@/hooks';
import { SUPPORTED_TOKENS } from '@/lib/constants/token-metadata';

export function DAppContent() {
  const { publicKey } = useWallet();
  const { data: depositAddress, isLoading: isLoadingAddress } =
    useDepositAddress();

  const {
    data: userBalances = [],
    isLoading: isLoadingBalances,
    refetch: refetchBalances,
  } = useUserBalances();

  const {
    data: unclaimedBalances = [],
    isLoading: isLoadingUnclaimed,
    refetch: refetchUnclaimed,
  } = useUnclaimedBalances();

  const withdrawMutation = useWithdrawMutation();

  const handleWithdraw = (
    erc20Address: string,
    amount: string,
    recipientAddress: string,
  ) => {
    withdrawMutation.mutate(
      {
        erc20Address,
        amount,
        recipientAddress,
        onStatusChange: status => {
          // Update UI based on status
          if (status.status === 'completed') {
            toast.success('Withdrawal completed successfully!');
          } else if (status.status === 'failed') {
            toast.error(status.error || 'Withdrawal failed');
          }
        },
      },
      {
        onSuccess: () => {
          toast.success('Withdrawal initiated successfully!');
        },
        onError: error => {
          console.error('Withdrawal failed:', error);
          toast.error(
            error instanceof Error ? error.message : 'Withdrawal failed',
          );
        },
      },
    );
  };

  if (!publicKey) {
    return <WelcomeScreen />;
  }

  return (
    <div className='space-y-6'>
      <IconCard
        icon={ArrowUpCircle}
        title='Sepolia Deposit Address'
        description='Send ERC20 tokens to this address on Sepolia testnet, then claim them on Solana'
        iconColor='green'
      >
        {isLoadingAddress ? (
          <LoadingIndicator message='Loading address...' />
        ) : depositAddress ? (
          <AddressDisplay address={depositAddress} variant='full' />
        ) : (
          <div className='p-4 text-center text-red-600'>
            Failed to load address
          </div>
        )}

        <UnclaimedBalances
          balances={unclaimedBalances}
          isLoading={isLoadingUnclaimed}
        />

        {/* Supported Tokens Section */}
        <div className='mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg'>
          <div className='flex items-center gap-2 mb-3'>
            <Info className='w-4 h-4 text-blue-600' />
            <span className='text-sm font-medium text-blue-900 dark:text-blue-100'>
              Supported Tokens
            </span>
          </div>
          <div className='space-y-2'>
            {SUPPORTED_TOKENS.map(token => (
              <div
                key={token.address}
                className='flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border'
              >
                <div className='flex items-center gap-2'>
                  <Badge variant='secondary'>{token.symbol}</Badge>
                  <span className='text-sm font-medium'>{token.name}</span>
                </div>
                <div className='flex items-center gap-2'>
                  <code className='text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded'>
                    {token.address.slice(0, 6)}...{token.address.slice(-4)}
                  </code>
                  <CopyButton text={token.address} size='sm' />
                </div>
              </div>
            ))}
          </div>
          <p className='text-xs text-blue-700 dark:text-blue-300 mt-2'>
            Only these tokens can be deposited to your Sepolia address. Other
            tokens will not be bridged.
          </p>
        </div>
      </IconCard>

      <IconCard
        icon={RefreshCw}
        title='Token Balances'
        description='ERC20 tokens available for withdrawal'
        iconColor='blue'
        actions={
          <Button
            size='sm'
            variant='outline'
            onClick={() => refetchBalances()}
            disabled={isLoadingBalances}
            className='gap-2'
          >
            {isLoadingBalances ? (
              <LoadingSpinner size='sm' />
            ) : (
              <RefreshCw className='h-4 w-4' />
            )}
            {isLoadingBalances ? 'Loading' : 'Refresh'}
          </Button>
        }
      >
        <BalanceTable
          balances={userBalances}
          onWithdraw={handleWithdraw}
          isLoading={isLoadingBalances || withdrawMutation.isPending}
        />
        <div className='mt-6'>
          <DepositFlow
            onRefreshBalances={() => {
              refetchBalances();
              refetchUnclaimed();
            }}
          />
        </div>
      </IconCard>
    </div>
  );
}
