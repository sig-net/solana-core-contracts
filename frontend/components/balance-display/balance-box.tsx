'use client';

import { cn } from '@/lib/utils';

import { ActionButtons } from './action-buttons';

export function BalanceBox({
  amount,
  usdValue,
  tokenSymbol,
  icon,
  className,
}: {
  amount: string;
  usdValue: string;
  tokenSymbol: string;
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between py-5 border-t border-dark-neutral-200 w-full',
        className,
      )}
    >
      <div className='flex gap-8'>
        <div className='flex flex-col gap-2'>
          <div className='text-3xl font-light text-text-primary'>{amount}</div>
          <div className='text-sm font-semibold text-text-secondary'>
            {usdValue}
          </div>
        </div>
        <div className='flex items-center gap-4'>
          {icon}
          <span className='text-base font-bold text-text-primary'>
            {tokenSymbol}
          </span>
        </div>
      </div>
      <ActionButtons />
    </div>
  );
}
