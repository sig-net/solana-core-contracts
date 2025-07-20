'use client';

import { useWallet } from '@solana/wallet-adapter-react';

import { NavigationHeader } from '@/components/navigation-header';
import { BalanceDisplay } from '@/components/balance-display';
import { SwapWidget } from '@/components/swap-widget';
import { ActivityList } from '@/components/activity-list';
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

  const handleUserClick = () => {
    console.log('User clicked');
  };

  const demoMode = true;
  if (!publicKey && !demoMode) {
    return (
      <div className='min-h-screen gradient-bg-main'>
        <NavigationHeader
          totalBalance={BigInt(0)}
          userInfo='Connect Wallet'
          onSettingsClick={handleSettingsClick}
          onUserClick={handleUserClick}
        />
        <div className='pt-[140px]'>
          <WelcomeScreen />
        </div>
      </div>
    );
  }

  const demoTotalBalance = BigInt(1800000000);
  const demoUserInfo = demoMode
    ? 'Demo Mode'
    : publicKey
      ? `${publicKey.toString().slice(0, 4)}...${publicKey.toString().slice(-4)}`
      : 'Connect Wallet';

  return (
    <div className='min-h-screen gradient-bg-main'>
      <NavigationHeader
        totalBalance={demoMode ? demoTotalBalance : totalBalance}
        balanceSymbol='SOL'
        balanceDecimals={9}
        userInfo={demoUserInfo}
        onSettingsClick={handleSettingsClick}
        onUserClick={handleUserClick}
      />

      <div className='flex min-h-screen pt-[140px]'>
        <div className='flex-1 max-w-[1027px]'>
          <div className='px-[60px] pt-[79px] pb-[40px]'>
            <div className='mb-[361px]'>
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
            </div>
            <div className='w-full max-w-[867px]'>
              <ActivityList />
            </div>
          </div>
        </div>

        <div className='hidden xl:flex w-[413px] flex-col border-l border-[#C6B3B2]'>
          <div className='flex flex-col pt-[80px] pb-[67px] px-4 gap-2.5'>
            <SwapWidget className='w-full' />

            <div className='p-10 space-y-[19px]'></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
