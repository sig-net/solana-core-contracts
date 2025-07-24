'use client';

import { Settings } from 'lucide-react';
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
        'border-dark-neutral-50 h-20 w-full border-b bg-stone-100',
        className,
      )}
    >
      <div className='container mx-auto flex h-full items-center justify-between'>
        {/* Left: Logo */}
        <Image
          src='/logo.svg'
          alt='Logo'
          width={140}
          height={28}
          className='object-contain'
          priority
        />

        {/* Center: Balance */}
        <div className='flex flex-col items-center'>
          <span className='text-dark-neutral-200 text-xs font-medium tracking-wider uppercase'>
            Total Balance
          </span>
          <span className='font-mono text-2xl font-light text-stone-700'>
            {displayBalance}
          </span>
        </div>

        {/* Right: Settings & Wallet */}
        <div className='justify-end space-x-4'>
          <Button
            variant='ghost'
            size='icon'
            onClick={onSettingsClick}
            className='h-10 w-10 text-stone-700 hover:bg-stone-700/10'
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
