'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { ArrowUpCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { IconCard } from '@/components/ui/icon-card';
import { AddressDisplay } from '@/components/ui/address-display';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import { WelcomeScreen } from '@/components/welcome-screen';
import { WelcomeMessage } from '@/components/welcome-message';
import { BalanceTable } from '@/components/balance-table';
import { DepositFlow } from '@/components/deposit-flow';
import { UnclaimedBalances } from '@/components/unclaimed-balances';
import {
  useDepositAddress,
  useUserBalances,
  useWithdrawMutation,
  useUnclaimedBalances,
} from '@/hooks';

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
      <WelcomeMessage publicKey={publicKey} />

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
