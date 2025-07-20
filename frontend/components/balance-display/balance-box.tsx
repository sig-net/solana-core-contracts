'use client';

import { cn } from '@/lib/utils';

import { ActionButtons } from './action-buttons';

export function BalanceBox({
  amount,
  usdValue,
  tokenSymbol,
  icon,
  className,
  onSwapClick,
  onSendClick,
}: {
  amount: string;
  usdValue: string;
  tokenSymbol: string;
  icon: React.ReactNode;
  className?: string;
  onSwapClick?: () => void;
  onSendClick?: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between py-5 border-t border-colors-dark-neutral-200 w-full',
        className,
      )}
    >
      <div className='flex gap-8'>
        <div className='flex flex-col gap-2'>
          <div className='text-3xl font-light text-tundora-300'>{amount}</div>
          <div className='text-sm font-semibold text-tundora-50'>
            {usdValue}
          </div>
        </div>
        <div className='flex items-center gap-4'>
          {icon}
          <span className='text-base font-bold text-tundora-300'>
            {tokenSymbol}
          </span>
        </div>
      </div>
      <ActionButtons onSwapClick={onSwapClick} onSendClick={onSendClick} />
    </div>
  );
}
