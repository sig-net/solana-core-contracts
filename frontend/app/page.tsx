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
    <div className='gradient-bg-main min-h-screen w-full overflow-x-hidden'>
      <NavigationHeader
        totalBalance={totalBalance}
        balanceDecimals={6}
        onSettingsClick={handleSettingsClick}
      />

      {!isWalletConnected ? (
        <div className='container mx-auto mt-16 p-4 md:p-0'>
          <EmptyStateWallet onDepositClick={handleDepositClick} />
        </div>
      ) : (
        <div className='container mx-auto mt-8 p-4 pb-16 md:p-0 lg:mt-16'>
          {/* Mobile: Swap widget at top, Desktop: Swap widget on right */}
          <div className='flex flex-col gap-6 lg:flex-row lg:gap-8'>
            {/* Swap widget - shows first on mobile, last on desktop */}
            <div className='order-1 w-full lg:order-2 lg:w-auto lg:shrink-0'>
              <SwapWidget />
            </div>

            {/* Main content - shows second on mobile, first on desktop */}
            <div className='order-2 flex w-full flex-col gap-8 lg:order-1 lg:flex-1 lg:gap-12'>
              <BalanceSection />
              <ActivityListTable />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
