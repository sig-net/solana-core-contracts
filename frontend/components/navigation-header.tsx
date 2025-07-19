'use client';

import { Settings, User } from 'lucide-react';
import { formatUnits } from 'viem';

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
  balanceSymbol = 'SOL',
  userInfo = 'User...wallet?',
  onSettingsClick,
  onUserClick,
}: NavigationHeaderProps) {
  const formattedBalance = formatUnits(totalBalance, balanceDecimals);

  return (
    <header
      className={cn(
        'w-full h-[140px] bg-[#F5F0EE] border-b border-[#C6B3B2] fixed top-0 left-0 right-0 z-50',
        className,
      )}
    >
      <div className='flex h-full py-10'>
        {/* Left Section - Logo and Balance */}
        <div className='flex items-center gap-[108px] pl-10'>
          {/* Logo Section with border-right */}
          <div className='flex items-center pr-[108px] border-r border-[#C6B3B2]'>
            {/* Logo placeholder - 188x38px */}
            <div className='w-[188px] h-[38px] bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center'>
              <span className='text-white font-bold text-lg'>LOGO</span>
            </div>
          </div>

          {/* Balance Display */}
          <div className='flex flex-col justify-center'>
            <p className='text-[#A28B8A] text-[16px] font-bold uppercase leading-tight'>
              Total balance
            </p>
            <p
              className='text-[#4C4646] text-[48px] leading-tight font-mono'
              style={{
                fontFamily:
                  'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
              }}
            >
              {formattedBalance} {balanceSymbol}
            </p>
          </div>
        </div>

        {/* Right Section - Settings and User buttons */}
        <div className='flex ml-auto'>
          {/* Settings Button */}
          <Button
            variant='ghost'
            onClick={onSettingsClick}
            className='w-[155px] h-[140px] border-l border-[#C6B3B2] rounded-none bg-transparent hover:bg-black/5 flex flex-col items-center justify-center gap-2 p-0'
          >
            <Settings className='w-5 h-5 text-[#4C4646]' />
            <span className='text-[#4C4646] text-sm font-medium'>Settings</span>
          </Button>

          {/* User/Wallet Button */}
          <Button
            variant='ghost'
            onClick={onUserClick}
            className='w-[257px] h-[140px] border-l border-[#C6B3B2] rounded-none bg-transparent hover:bg-black/5 flex flex-col items-center justify-center gap-2 p-0'
          >
            <User className='w-5 h-5 text-[#4C4646]' />
            <span className='text-[#4C4646] text-sm font-medium'>
              {userInfo}
            </span>
          </Button>
        </div>
      </div>
    </header>
  );
}
