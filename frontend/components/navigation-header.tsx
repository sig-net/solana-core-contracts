'use client';

import { Settings, User } from 'lucide-react';
import { formatUnits } from 'viem';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NavigationHeaderProps {
  className?: string;
  totalBalance?: bigint;
  balanceDecimals?: number;
  balanceSymbol?: string;
  userInfo?: string;
  onSettingsClick?: () => void;
  onUserClick?: () => void;
}

export function NavigationHeader({
  className,
  totalBalance = BigInt(0),
  balanceDecimals = 9,
  balanceSymbol: _balanceSymbol = 'SOL',
  userInfo = 'User...wallet?',
  onSettingsClick,
  onUserClick,
}: NavigationHeaderProps) {
  const formattedBalance = formatUnits(totalBalance, balanceDecimals);

  return (
    <header
      className={cn(
        'w-full h-[140px] bg-[#F5F0EE] border-b border-[#C6B3B2]',
        className,
      )}
    >
      <div className='flex h-full items-center'>
        {/* Left Section - Logo */}
        <div className='flex items-center justify-center h-full px-[60px] border-r border-[#C6B3B2]'>
          <Image
            src='/logo.svg'
            alt='Logo'
            width={188}
            height={38}
            className='object-contain'
          />
        </div>

        {/* Balance Display */}
        <div className='flex flex-col justify-center gap-[15px] px-[60px]'>
          <p className='text-[#A28B8A] text-[16px] font-bold uppercase tracking-[0.1em] leading-[18px]'>
            Total balance
          </p>
          <p className='text-[#4C4646] text-[48px] leading-[72px] tracking-[-0.01em] font-light font-mono'>
            ${formattedBalance}
          </p>
        </div>

        {/* Spacer to push right section to end */}
        <div className='flex-1' />

        {/* Right Section - Settings and User buttons */}
        <div className='flex h-full'>
          {/* Settings Button */}
          <Button
            variant='ghost'
            onClick={onSettingsClick}
            className='w-[155px] h-full border-l border-[#C6B3B2] rounded-none bg-transparent hover:bg-black/5 flex flex-col items-center justify-center gap-[7px] p-0'
          >
            <Settings className='w-5 h-5 text-[#4C4646]' />
            <span className='text-[#4C4646] text-[16px] font-medium leading-5'>
              Settings
            </span>
          </Button>

          {/* User/Wallet Button */}
          <Button
            variant='ghost'
            onClick={onUserClick}
            className='w-[257px] h-full border-l border-[#C6B3B2] rounded-none bg-transparent hover:bg-black/5 flex flex-col items-center justify-center gap-[7px] p-0'
          >
            <User className='w-5 h-5 text-[#4C4646]' />
            <span className='text-[#4C4646] text-[16px] font-medium leading-5'>
              {userInfo}
            </span>
          </Button>
        </div>
      </div>
    </header>
  );
}
