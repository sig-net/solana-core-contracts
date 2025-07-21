'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

import { NavigationHeader } from '@/components/navigation-header';
import { BalanceDisplay } from '@/components/balance-display';
import { SwapWidget } from '@/components/swap-widget';
import { ActivityListTable } from '@/components/activity-list-table';
import { DepositDialog } from '@/components/deposit-dialog';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { EmptyStateWallet } from '@/components/empty-state-wallet';
import { useUserBalances } from '@/hooks';
import { convertTokenBalancesToDisplayTokens } from '@/lib/utils';
import { Package } from 'lucide-react';

export default function Home() {
  const { publicKey } = useWallet();
  const { data: userBalances = [], isLoading, error } = useUserBalances();
  const [isDepositDialogOpen, setIsDepositDialogOpen] = useState(false);

  const totalBalance = userBalances.reduce((sum, balance) => {
    return sum + BigInt(balance.amount || 0);
  }, BigInt(0));

  const handleSettingsClick = () => {
    console.log('Settings clicked');
  };

  const handleDepositClick = () => {
    setIsDepositDialogOpen(true);
  };

  // Convert blockchain token balances to display tokens
  const displayTokens = convertTokenBalancesToDisplayTokens(userBalances);

  // Check if wallet is connected
  const isWalletConnected = !!publicKey;

  return (
    <div className='min-h-screen gradient-bg-main'>
      <NavigationHeader
        totalBalance={totalBalance}
        balanceDecimals={6}
        onSettingsClick={handleSettingsClick}
      />

      {!isWalletConnected ? (
        <div className='container mx-auto mt-16'>
          <EmptyStateWallet onDepositClick={handleDepositClick} />
        </div>
      ) : (
        <div className='flex container mx-auto mt-16 justify-between'>
          <div className='flex flex-col gap-12'>
            {isLoading ? (
              <div className='flex items-center justify-center p-8'>
                <div className='text-white/70'>Loading balances...</div>
              </div>
            ) : error ? (
              <div className='flex items-center justify-center p-8'>
                <div className='text-red-400'>
                  Error loading balances:{' '}
                  {error instanceof Error ? error.message : 'Unknown error'}
                </div>
              </div>
            ) : displayTokens.length === 0 ? (
              <EmptyState
                icon={Package}
                title='No tokens found'
                description='Deposit some tokens to get started with the bridge.'
                compact
                action={
                  <Button onClick={handleDepositClick} variant='default'>
                    Deposit Tokens
                  </Button>
                }
              />
            ) : (
              <BalanceDisplay tokens={displayTokens} />
            )}
            <ActivityListTable />
          </div>
          <SwapWidget />
        </div>
      )}

      <DepositDialog
        open={isDepositDialogOpen}
        onOpenChange={setIsDepositDialogOpen}
      />
    </div>
  );
}

export const dynamic = 'force-dynamic';
