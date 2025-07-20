'use client';

import { useWallet } from '@solana/wallet-adapter-react';

import { NavigationHeader } from '@/components/navigation-header';
import { BalanceDisplay } from '@/components/balance-display';
import { SwapWidget } from '@/components/swap-widget';
import { ActivityListTable } from '@/components/activity-list-table';
import { WelcomeScreen } from '@/components/welcome-screen';
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

  const demoMode = true;
  if (!publicKey && !demoMode) {
    return (
      <div className='min-h-screen gradient-bg-main'>
        <NavigationHeader
          totalBalance={BigInt(0)}
          onSettingsClick={handleSettingsClick}
        />
        <WelcomeScreen />
      </div>
    );
  }

  const demoTotalBalance = BigInt(1800000000);

  return (
    <div className='min-h-screen gradient-bg-main'>
      <NavigationHeader
        totalBalance={demoMode ? demoTotalBalance : totalBalance}
        balanceDecimals={9}
        onSettingsClick={handleSettingsClick}
      />
      <div className='flex container mx-auto mt-16 justify-between'>
        <div className='flex flex-col gap-10'>
          <BalanceDisplay
            tokens={[
              {
                balance: demoMode ? demoTotalBalance : totalBalance,
                token: 'SOL',
                chain: 'solana',
                decimals: 9,
              },
              {
                balance: demoMode ? demoTotalBalance : totalBalance,
                token: 'ETH',
                chain: 'ethereum',
                decimals: 18,
              },
            ]}
          />
          <ActivityListTable />
        </div>
        <SwapWidget className='w-90' />
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
