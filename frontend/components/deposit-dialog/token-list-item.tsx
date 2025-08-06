'use client';

import { CryptoIcon } from '@/components/balance-display/crypto-icon';
import { cn } from '@/lib/utils';

interface TokenListItemProps {
  symbol: string;
  name: string;
  chain: string;
  chainName?: string;
  balance?: string;
  balanceUsd?: string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function TokenListItem({
  symbol,
  name,
  chain,
  chainName,
  balance,
  balanceUsd,
  onClick,
  className,
}: TokenListItemProps) {
  return (
    <button
      className={cn(
        'bg-pastels-green-white-200 flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left',
        className,
      )}
      onClick={onClick}
    >
      <div className='flex items-center gap-3'>
        <CryptoIcon chain={chain} token={symbol} className='size-6 shrink-0' />
        <div className='flex flex-col'>
          <span className='font-medium text-stone-700'>{symbol}</span>
          <span className='text-dark-neutral-300 text-xs'>
            {name} • on {chainName || chain}
          </span>
        </div>
      </div>
      {balance && (
        <div className='text-right'>
          <div className='text-sm text-stone-700'>{balance}</div>
          {balanceUsd && (
            <div className='text-dark-neutral-300 text-xs'>{balanceUsd}</div>
          )}
        </div>
      )}
    </button>
  );
}
