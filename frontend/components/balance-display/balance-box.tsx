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
        'border-colors-dark-neutral-200 flex w-full items-center justify-between border-t py-5',
        className,
      )}
    >
      <div className='flex gap-8'>
        <div className='flex flex-col gap-2'>
          <div className='text-tundora-300 text-3xl font-light'>{amount}</div>
          <div className='text-tundora-50 text-sm font-semibold'>
            {usdValue}
          </div>
        </div>
        <div className='flex items-center gap-4'>
          {icon}
          <span className='text-tundora-300 text-base font-bold'>
            {tokenSymbol}
          </span>
        </div>
      </div>
      <ActionButtons onSwapClick={onSwapClick} onSendClick={onSendClick} />
    </div>
  );
}
