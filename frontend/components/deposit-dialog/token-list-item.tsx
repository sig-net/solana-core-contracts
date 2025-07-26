'use client';

import { CryptoIcon } from '@/components/balance-display/crypto-icon';
import { cn } from '@/lib/utils';

interface TokenListItemProps {
  symbol: string;
  name: string;
  chain: string;
  onClick?: () => void;
  className?: string;
}

export function TokenListItem({
  symbol,
  name,
  chain,
  onClick,
  className,
}: TokenListItemProps) {
  return (
    <button
      className={cn(
        'bg-pastels-green-white-200 flex size-full cursor-pointer gap-4 rounded-sm p-4 text-left',
        'hover:bg-pastels-mercury-100',
        className,
      )}
      onClick={onClick}
    >
      <CryptoIcon chain={chain} token={symbol} className='h-8 w-8 shrink-0' />
      <div className='flex flex-col'>
        <span className='text-dark-neutral-500'>{symbol}</span>
        <span className='text-dark-neutral-300 text-xs'>
          {name} • on {chain}
        </span>
      </div>
    </button>
  );
}
