'use client';

import { cn } from '@/lib/utils';
import { TokenIcon, NetworkIcon } from '@web3icons/react';

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
        'w-7 h-7 rounded-full flex items-center justify-center shadow-sm relative',
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
        className='rounded-full absolute bottom-0 -right-1.5 w-4 h-4'
      />
    </div>
  );
}
