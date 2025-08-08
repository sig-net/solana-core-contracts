'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { CryptoIcon } from '@/components/balance-display/crypto-icon';
import type { Token } from '@/lib/types/token.types';

// Token with optional balance info for selection
interface TokenSelectOption extends Token {
  chainName?: string;
  balance?: string;
  balanceUsd?: string;
}

interface TokenSelectProps {
  tokens: TokenSelectOption[];
  value?: TokenSelectOption;
  onChange?: (token: TokenSelectOption) => void;
  placeholder?: string;
  className?: string;
  showBalance?: boolean;
}

export function TokenSelect({
  tokens,
  value,
  onChange,
  placeholder = 'Select a token',
  className,
  showBalance = true,
}: TokenSelectProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type='button'
          className={cn(
            'border-dark-neutral-50 hover:border-dark-neutral-200 focus:border-dark-neutral-400 focus:ring-dark-neutral-400 flex w-full items-center justify-between rounded-sm border bg-white px-3 py-2 text-sm transition-colors focus:ring-1 focus:ring-offset-0 focus:outline-none',
            className,
          )}
          aria-expanded={open}
          aria-haspopup='listbox'
        >
          {value ? (
            <div className='flex items-center gap-3'>
              <CryptoIcon
                chain={value.chain}
                token={value.symbol}
                className='size-6'
              />
              <div className='text-left'>
                <span className='font-medium text-stone-700'>
                  {value.symbol}
                </span>
                <span className='text-dark-neutral-300 ml-2 text-xs'>
                  on {value.chainName || value.chain}
                </span>
              </div>
            </div>
          ) : (
            <span className='text-dark-neutral-300'>{placeholder}</span>
          )}
          <ChevronDown className='text-dark-neutral-400 h-4 w-4' />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className='w-[var(--radix-popover-trigger-width)] p-0'
        align='start'
      >
        <div className='max-h-96 overflow-y-auto'>
          <div className='text-dark-neutral-300 p-2 text-xs font-medium uppercase'>
            In your wallet
          </div>
          {tokens.map((token, index) => {
            const isSelected =
              value?.symbol === token.symbol && value?.chain === token.chain;
            return (
              <button
                key={`${token.chain}-${token.symbol}-${index}`}
                type='button'
                onClick={() => {
                  onChange?.(token);
                  setOpen(false);
                }}
                className={cn(
                  'hover:bg-pastels-green-white-300 flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition-colors',
                  isSelected && 'bg-pastels-green-white-300',
                )}
              >
                <div className='flex items-center gap-3'>
                  <CryptoIcon
                    chain={token.chain}
                    token={token.symbol}
                    className='size-6 shrink-0'
                  />
                  <div className='flex flex-col'>
                    <span className='text-sm font-medium text-stone-700'>
                      {token.symbol}
                    </span>
                    <span className='text-dark-neutral-300 text-xs'>
                      {token.name} • on {token.chainName || token.chain}
                    </span>
                  </div>
                </div>
                {showBalance && token.balance && (
                  <div className='text-right'>
                    <div className='text-sm text-stone-700'>
                      {token.balance}
                    </div>
                    {token.balanceUsd && (
                      <div className='text-dark-neutral-300 text-xs'>
                        {token.balanceUsd}
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
