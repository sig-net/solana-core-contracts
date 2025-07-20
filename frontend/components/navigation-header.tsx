'use client';

import { Settings, Wallet } from 'lucide-react';
import { formatUnits } from 'viem';
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
  const formattedBalance = formatUnits(totalBalance, balanceDecimals);
  const displayBalance = `$${parseFloat(formattedBalance).toFixed(2)}`;

  return (
    <header
      className={cn(
        'w-full h-20 bg-header-bg border-b border-header-border px-6',
        className,
      )}
    >
      <div className='flex items-center justify-between h-full max-w-7xl mx-auto'>
        {/* Left: Logo */}
        <div className='flex items-center'>
          <Image
            src='/logo.svg'
            alt='Logo'
            width={140}
            height={28}
            className='object-contain'
            priority
          />
        </div>

        {/* Center: Balance */}
        <div className='flex flex-col items-center'>
          <span className='text-header-text-secondary text-xs font-medium uppercase tracking-wider'>
            Total Balance
          </span>
          <span className='text-header-text-primary text-2xl font-light font-mono'>
            {displayBalance}
          </span>
        </div>

        {/* Right: Settings & Wallet */}
        <div className='flex items-center gap-4'>
          <Button
            variant='ghost'
            size='icon'
            onClick={onSettingsClick}
            className='h-10 w-10 text-header-text-primary hover:bg-header-text-primary/10'
            aria-label='Settings'
          >
            <Settings className='h-5 w-5' />
          </Button>

          <WalletButton />
        </div>
      </div>
    </header>
  );
}
