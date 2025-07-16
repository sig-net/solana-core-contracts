'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { ArrowUpCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CopyButton } from '@/components/ui/copy-button';
import { WelcomeScreen } from '@/components/welcome-screen';
import { BalanceTable } from '@/components/balance-table';
import { PendingDepositsTable } from '@/components/pending-deposits-table';
import { formatAddress } from '@/lib/address-utils';
import { DepositFlow } from '@/components/deposit-flow';
import {
  useDepositAddress,
  useUserBalances,
  useWithdrawMutation,
  usePendingDeposits,
  useClaimErc20Mutation,
  useSubmitSignedTransactionMutation,
} from '@/hooks/use-solana-queries';

function DAppContent() {
  const { publicKey } = useWallet();
  const { data: depositAddress, isLoading: isLoadingAddress } =
    useDepositAddress();

  const {
    data: userBalances = [],
    isLoading: isLoadingBalances,
    refetch: refetchBalances,
  } = useUserBalances();

  const {
    data: pendingDeposits = [],
    isLoading: isLoadingPendingDeposits,
    refetch: refetchPendingDeposits,
  } = usePendingDeposits();

  const withdrawMutation = useWithdrawMutation();
  const claimMutation = useClaimErc20Mutation();
  const submitTransactionMutation = useSubmitSignedTransactionMutation();

  // State for tracking individual button loading states
  const [claimingMap, setClaimingMap] = useState<Record<string, boolean>>({});
  const [submittingMap, setSubmittingMap] = useState<Record<string, boolean>>(
    {},
  );

  // Update claiming state when mutation state changes
  useEffect(() => {
    if (!claimMutation.isPending) {
      setClaimingMap({});
    }
  }, [claimMutation.isPending]);

  // Update submitting state when mutation state changes
  useEffect(() => {
    if (!submitTransactionMutation.isPending) {
      setSubmittingMap({});
    }
  }, [submitTransactionMutation.isPending]);

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

  const handleClaim = (requestId: string) => {
    setClaimingMap(prev => ({ ...prev, [requestId]: true }));
    claimMutation.mutate(
      { requestId },
      {
        onSuccess: () => {
          toast.success('Tokens claimed successfully!');
        },
        onError: error => {
          console.error('Claim failed:', error);
          toast.error(error instanceof Error ? error.message : 'Claim failed');
        },
      },
    );
  };

  const handleSubmitTransaction = (requestId: string) => {
    setSubmittingMap(prev => ({ ...prev, [requestId]: true }));
    submitTransactionMutation.mutate(
      { requestId },
      {
        onSuccess: () => {
          toast.success('Transaction submitted successfully!');
        },
        onError: error => {
          console.error('Submit transaction failed:', error);
          toast.error(
            error instanceof Error
              ? error.message
              : 'Submit transaction failed',
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
      {/* Welcome message */}
      <div className='text-center py-6'>
        <h2 className='text-xl font-semibold mb-2'>Welcome back!</h2>
        <p className='text-muted-foreground'>
          Wallet connected: {formatAddress(publicKey.toString())}
        </p>
      </div>

      {/* Deposit Address Card */}
      <Card className='hover:shadow-md transition-shadow'>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-3'>
              <div className='w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center'>
                <ArrowUpCircle className='h-4 w-4 text-green-600 dark:text-green-400' />
              </div>
              <div>
                <CardTitle className='text-base'>
                  Sepolia Deposit Address
                </CardTitle>
                <CardDescription>
                  Send ERC20 tokens to this address on Sepolia testnet, then
                  claim them on Solana
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className='flex items-center space-x-3 p-4 bg-muted/30 rounded-lg border border-dashed'>
            <code className='flex-1 text-sm font-mono break-all select-all'>
              {isLoadingAddress
                ? 'Loading address...'
                : depositAddress || 'Failed to load address'}
            </code>
            {depositAddress && !isLoadingAddress && (
              <CopyButton
                text={depositAddress}
                variant='outline'
                showText
                size='sm'
              />
            )}
            {isLoadingAddress && <LoadingSpinner size='sm' />}
          </div>
        </CardContent>
      </Card>

      {/* Pending Deposits Card */}
      {pendingDeposits.length > 0 && (
        <Card className='hover:shadow-md transition-shadow'>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <div className='flex items-center space-x-3'>
                <div className='w-8 h-8 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center'>
                  <ArrowUpCircle className='h-4 w-4 text-orange-600 dark:text-orange-400' />
                </div>
                <div>
                  <CardTitle className='text-base'>Pending Deposits</CardTitle>
                  <CardDescription>
                    Deposits being processed through the MPC system
                  </CardDescription>
                </div>
              </div>
              <Button
                size='sm'
                variant='outline'
                onClick={() => refetchPendingDeposits()}
                disabled={isLoadingPendingDeposits}
                className='gap-2'
              >
                {isLoadingPendingDeposits ? (
                  <LoadingSpinner size='sm' />
                ) : (
                  <RefreshCw className='h-4 w-4' />
                )}
                {isLoadingPendingDeposits ? 'Loading' : 'Refresh'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <PendingDepositsTable
              pendingDeposits={pendingDeposits}
              onClaim={handleClaim}
              onSubmitTransaction={handleSubmitTransaction}
              isLoading={isLoadingPendingDeposits}
              isClaimingMap={claimingMap}
              isSubmittingMap={submittingMap}
            />
          </CardContent>
        </Card>
      )}

      {/* Balances Card */}
      <Card className='hover:shadow-md transition-shadow'>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-3'>
              <div className='w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center'>
                <RefreshCw className='h-4 w-4 text-blue-600 dark:text-blue-400' />
              </div>
              <div>
                <CardTitle className='text-base'>Token Balances</CardTitle>
                <CardDescription>
                  ERC20 tokens available for withdrawal
                </CardDescription>
              </div>
            </div>
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
          </div>
        </CardHeader>
        <CardContent>
          <BalanceTable
            balances={userBalances}
            onWithdraw={handleWithdraw}
            isLoading={isLoadingBalances || withdrawMutation.isPending}
          />
          <div className='mt-6'>
            <DepositFlow onRefreshBalances={refetchBalances} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Home() {
  return <DAppContent />;
}

// Force client-side rendering for this page
export const dynamic = 'force-dynamic';
