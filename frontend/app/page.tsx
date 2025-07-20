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

  // Temporarily bypass wallet check for demo purposes
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

  // Demo data for testing the balance components
  const demoTotalBalance = BigInt(1800000000); // 1.8 SOL in lamports
  const demoUserInfo = demoMode ? 'Demo Mode' : (publicKey ? `${publicKey.toString().slice(0, 4)}...${publicKey.toString().slice(-4)}` : 'Connect Wallet');

  return (
    <div className='min-h-screen gradient-bg-main'>
      {/* Navigation Header */}
      <NavigationHeader
        totalBalance={demoMode ? demoTotalBalance : totalBalance}
        balanceSymbol='SOL'
        balanceDecimals={9}
        userInfo={demoUserInfo}
        onSettingsClick={handleSettingsClick}
        onUserClick={handleUserClick}
      />

      {/* Main Layout Container */}
      <div className='flex min-h-screen pt-[140px]'>
        {/* Left Content Area - Main content */}
        <div className='flex-1 max-w-[1027px]'>
          {/* Frame 178 - Token Dashboard Area with proper spacing */}
          <div className='px-[60px] pt-[79px] pb-[40px]'>
            {/* Frame 8 & Frame 172 - Balance display section */}
            <div className='mb-[361px]'>
              <BalanceDisplay
                balance={demoMode ? demoTotalBalance : totalBalance}
                symbol='SOL'
                decimals={9}
              />
            </div>

            {/* Frame 134 - Activity List section */}
            <div className='w-full max-w-[867px]'>
              <ActivityList />
            </div>
          </div>
        </div>

        {/* Right Sidebar - Frame 300:2933 */}
        <div className='hidden xl:flex w-[413px] flex-col border-l border-[#C6B3B2]'>
          {/* Sidebar content with Figma spacing: padding 220px 0px 207px, gap 10px */}
          <div className='flex flex-col pt-[80px] pb-[67px] px-4 gap-2.5'>
            {/* Swap Widget - 300:2934 */}
            <SwapWidget className='w-full' />

            {/* Frame 173 - Additional content area with 40px padding, 19px gap */}
            <div className='p-10 space-y-[19px]'>
              {/* Additional sidebar content can go here */}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile/Tablet Layout - Responsive grid for smaller screens */}
      <div className='xl:hidden pt-[140px]'>
        <div className='container mx-auto px-6 py-12'>
          <div className='grid grid-cols-1 gap-8 lg:grid-cols-3'>
            {/* Main content area */}
            <div className='space-y-8 lg:col-span-2'>
              <BalanceDisplay
                balance={demoMode ? demoTotalBalance : totalBalance}
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
  );
}

// Force client-side rendering for this page
export const dynamic = 'force-dynamic';
