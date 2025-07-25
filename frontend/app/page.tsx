'use client';

import { useWallet } from '@solana/wallet-adapter-react';

import { NavigationHeader } from '@/components/navigation-header';
import { BalanceSection } from '@/components/balance-section';
import { SwapWidget } from '@/components/swap-widget';
import { ActivityListTable } from '@/components/activity-list-table';
import { EmptyStateWallet } from '@/components/empty-state-wallet';
import { useUserBalances } from '@/hooks';

export default function Home() {
  const { publicKey } = useWallet();
  const { data: userBalances = [] } = useUserBalances();

  const totalBalance = userBalances.reduce((sum, balance) => {
    return sum + BigInt(balance.amount || 0);
  }, BigInt(0));

  const handleSettingsClick = () => {
    console.log('Settings clicked');
  };

  const handleDepositClick = () => {
    console.log('Deposit clicked');
  };

  // Check if wallet is connected
  const isWalletConnected = !!publicKey;

  return (
    <div className='gradient-bg-main min-h-screen'>
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
        <div className='container mx-auto mt-16 flex justify-between gap-8 pb-16'>
          <div className='flex flex-col gap-12'>
            <BalanceSection />
            <ActivityListTable />
          </div>
          <SwapWidget />
        </div>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
