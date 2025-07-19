'use client';

import { formatUnits } from 'viem';

import { cn } from '@/lib/utils';

interface BalanceDisplayProps {
  balance?: bigint;
  symbol?: string;
  decimals?: number;
  className?: string;
}

export function BalanceDisplay({
  balance = BigInt(0),
  symbol = 'SOL',
  decimals = 9,
  className,
}: BalanceDisplayProps) {
  const formattedBalance = formatUnits(balance, decimals);
  const [whole, decimal] = formattedBalance.split('.');

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#F0F4F0] to-[#F9F6F6] p-8',
        className,
      )}
    >
      <div className='relative z-10'>
        <p className='text-sm font-medium text-gray-600'>Total Balance</p>
        <div className='mt-2 flex items-baseline gap-2'>
          <span className='text-5xl font-bold text-gray-900'>{whole}</span>
          {decimal && (
            <span className='text-3xl font-semibold text-gray-600'>
              .{decimal.slice(0, 4)}
            </span>
          )}
          <span className='text-2xl font-semibold text-gray-700'>{symbol}</span>
        </div>
        <div className='mt-4 flex items-center gap-4'>
          <div>
            <p className='text-xs text-gray-500'>24h Change</p>
            <p className='text-sm font-semibold text-green-600'>+2.34%</p>
          </div>
          <div className='h-8 w-px bg-gray-300' />
          <div>
            <p className='text-xs text-gray-500'>USD Value</p>
            <p className='text-sm font-semibold text-gray-700'>$1,234.56</p>
          </div>
        </div>
      </div>

      {/* Gradient overlay circles */}
      <div className='absolute -right-20 -top-20 h-40 w-40 rounded-full bg-gradient-to-br from-purple-200/30 to-pink-200/30 blur-3xl' />
      <div className='absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-gradient-to-tr from-teal-200/30 to-blue-200/30 blur-3xl' />
    </div>
  );
}
