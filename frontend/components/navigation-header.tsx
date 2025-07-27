'use client';

import { Settings } from 'lucide-react';
import { formatTokenBalanceSync } from '@/lib/utils/balance-formatter';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { WalletButton } from '@/components/wallet-button';
import { cn } from '@/lib/utils';

interface NavigationHeaderProps {
  className?: string;
  totalBalance?: bigint;
  balanceDecimals?: number;
  onSettingsClick?: () => void;
}

export function NavigationHeader({
  className,
  totalBalance = BigInt(0),
  balanceDecimals = 9,
  onSettingsClick,
}: NavigationHeaderProps) {
  // Format as USD value (assuming totalBalance is already in USD units)
  const displayBalance = `$${formatTokenBalanceSync(
    totalBalance,
    balanceDecimals,
    undefined,
    { precision: 2 },
  )}`;

  return (
    <header
      className={cn(
        'border-dark-neutral-50 h-16 w-full border-b bg-stone-100 sm:h-20',
        className,
      )}
    >
      <div className='container mx-auto flex h-full items-center justify-between p-4 md:p-0'>
        {/* Left: Logo */}
        <div className='flex-shrink-0'>
          <Image
            src='/logo.svg'
            alt='Logo'
            width={120}
            height={24}
            className='max-w-24 object-contain sm:h-7 sm:w-36 sm:max-w-36'
            priority
          />
        </div>

        {/* Center: Balance - Hide on small screens, show on md+ */}
        <div className='hidden flex-col items-center md:flex'>
          <span className='text-dark-neutral-200 text-xs font-medium tracking-wider uppercase'>
            Total Balance
          </span>
          <span className='font-mono text-xl font-light text-stone-700 lg:text-2xl'>
            {displayBalance}
          </span>
        </div>

        {/* Right: Settings & Wallet */}
        <div className='flex flex-shrink-0 items-center justify-end space-x-2 sm:space-x-4'>
          <Button
            variant='ghost'
            size='icon'
            onClick={onSettingsClick}
            className='h-8 w-8 text-stone-700 hover:bg-stone-700/10 sm:h-10 sm:w-10'
            aria-label='Settings'
          >
            <Settings className='h-4 w-4 sm:h-5 sm:w-5' />
          </Button>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
