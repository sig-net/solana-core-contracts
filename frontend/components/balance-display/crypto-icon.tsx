'use client';

import { TokenIcon, NetworkIcon } from '@web3icons/react';

import { cn } from '@/lib/utils';

export function CryptoIcon({
  chain,
  token,
  className,
}: {
  chain: string;
  token: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative flex h-7 w-7 items-center justify-center rounded-full shadow-sm',
        className,
      )}
    >
      <TokenIcon
        symbol={token}
        size={28}
        variant='background'
        className='rounded-full'
      />

      <NetworkIcon
        name={chain}
        size={16}
        variant='background'
        className='absolute -right-1.5 bottom-0 h-4 w-4 rounded-sm'
      />
    </div>
  );
}
