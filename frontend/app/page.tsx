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

  // Calculate total balance in SOL (for demo purposes)
  const totalBalance = userBalances.reduce((sum, balance) => {
    return sum + BigInt(balance.amount || 0);
  }, BigInt(0));

  // Format user info for display
  const userInfo = publicKey
    ? `${publicKey.toString().slice(0, 4)}...${publicKey.toString().slice(-4)}`
    : 'Connect Wallet';

  const handleSettingsClick = () => {
    console.log('Settings clicked');
    // TODO: Implement settings modal
  };

  const handleUserClick = () => {
    console.log('User clicked');
    // TODO: Implement user menu or wallet management
  };

  if (!publicKey) {
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

  return (
    <div className='min-h-screen gradient-bg-main relative'>
      {/* Navigation Header */}
      <NavigationHeader
        totalBalance={totalBalance}
        balanceSymbol='SOL'
        balanceDecimals={9}
        userInfo={userInfo}
        onSettingsClick={handleSettingsClick}
        onUserClick={handleUserClick}
      />

      {/* Main Layout Container - Figma viewport 1440x1072 */}
      <div className='w-full relative'>
        {/* Desktop Layout - matches Figma design exactly */}
        <div className='hidden xl:block'>
          {/* Right Sidebar - Frame 300:2933 - 413px width, padding 220px 0px 207px, gap 10px */}
          <div className='fixed right-0 top-0 w-[413px] h-screen flex flex-col justify-start pt-[220px] pb-[207px] pr-4 gap-2.5 z-10'>
            {/* Swap Widget - 300:2934 */}
            <div className='w-full max-w-[380px]'>
              <SwapWidget />
            </div>

            {/* Frame 173 - 40px padding, 19px gap */}
            <div className='w-full p-10 space-y-[19px]'>
              {/* Additional content can go here if needed */}
            </div>
          </div>

          {/* Main Content Area - left side, accounting for right sidebar */}
          <div className='mr-[413px] min-h-screen relative'>
            {/* Token Dashboard Area - Frame 178 at x:60, y:219, width:867px */}
            <div
              className='absolute left-[60px] top-[219px] w-[867px]'
              style={{ marginTop: '0px' }}
            >
              {/* Frame 8 - title section with 16px gap */}
              <div className='space-y-4 mb-6'>
                {/* Frame 172 - balance display with 42px gap */}
                <div className='space-y-[42px]'>
                  {/* Balance box component - 293:4845 with 67px gap and 20px vertical padding */}
                  <div className='py-5 space-y-[67px]'>
                    <BalanceDisplay
                      balance={totalBalance}
                      symbol='SOL'
                      decimals={9}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content Area - Frame 134 at x:60, y:580, width:867px */}
            <div
              className='absolute left-[60px] top-[580px] w-[867px]'
              style={{ marginTop: '0px' }}
            >
              <ActivityList />
            </div>
          </div>
        </div>

        {/* Responsive Layout for smaller screens */}
        <div className='xl:hidden'>
          <div className='container mx-auto px-6 py-12 pt-[140px]'>
            <div className='grid grid-cols-1 gap-8 lg:grid-cols-3'>
              {/* Main content area */}
              <div className='space-y-8 lg:col-span-2'>
                <BalanceDisplay
                  balance={totalBalance}
                  symbol='SOL'
                  decimals={9}
                />
                <ActivityList />
              </div>

              {/* Sidebar with swap widget */}
              <div className='lg:col-span-1'>
                <div className='sticky top-8'>
                  <SwapWidget />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Force client-side rendering for this page
export const dynamic = 'force-dynamic';
