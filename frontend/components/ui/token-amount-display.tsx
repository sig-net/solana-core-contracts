'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { CryptoIcon } from '@/components/balance-display/crypto-icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface Token {
  symbol: string;
  name: string;
  chain: 'ethereum' | 'solana';
  address: string;
  balance: string;
  decimals: number;
}

interface TokenAmountDisplayProps {
  value: string;
  onChange: (value: string) => void;
  tokens: Token[];
  selectedToken?: Token;
  onTokenSelect: (token: Token) => void;
  usdValue?: string;
  className?: string;
  placeholder?: string;
}

export function TokenAmountDisplay({
  value,
  onChange,
  tokens,
  selectedToken,
  onTokenSelect,
  usdValue,
  className = '',
  placeholder = '0.00',
}: TokenAmountDisplayProps) {
  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    if (num === 0) return '0';
    if (num < 0.01) return '< 0.01';
    return num.toFixed(6).replace(/\.?0+$/, '');
  };

  const handleMaxClick = () => {
    if (selectedToken) {
      onChange(selectedToken.balance);
    }
  };
  return (
    <div
      className={`bg-pastels-swiss-coffee-200 border-dark-neutral-400/80 flex flex-col gap-3 rounded-sm border p-5 ${className}`}
    >
      <div className='flex w-full flex-col gap-2.5'>
        <div className='flex w-full items-center justify-between gap-3'>
          <div className='flex min-w-0 flex-1 items-center gap-2'>
            <input
              type='text'
              value={value}
              onChange={e => onChange(e.target.value)}
              placeholder={placeholder}
              className='text-dark-neutral-500 w-full min-w-0 border-none bg-transparent font-mono text-[20px] leading-[1.5] outline-none'
              style={{ width: '100%' }}
            />
            {selectedToken && (
              <button
                type='button'
                onClick={handleMaxClick}
                className='text-dark-neutral-300 hover:text-dark-neutral-400 ml-2 shrink-0 text-xs font-medium underline decoration-dotted underline-offset-2 transition-colors'
              >
                max
              </button>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className='bg-pastels-pampas-500 border-dark-neutral-50 hover:bg-pastels-pampas-500/80 flex h-8 min-w-[80px] shrink-0 items-center gap-2 rounded-sm border px-3 py-1 transition-colors'>
                <CryptoIcon
                  chain={selectedToken?.chain || 'ethereum'}
                  token={selectedToken?.symbol || 'BTC'}
                  className='size-4'
                />
                <span className='text-dark-neutral-400 text-sm font-medium'>
                  {selectedToken?.symbol || 'BTC'}
                </span>
                <ChevronDown className='text-dark-neutral-400 size-4' />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='min-w-[120px]'>
              {tokens.map((token, index) => (
                <DropdownMenuItem
                  key={`${token.chain}-${token.address}-${index}`}
                  onClick={() => onTokenSelect(token)}
                  className='flex h-8 cursor-pointer items-center gap-2 px-3'
                >
                  <CryptoIcon
                    chain={token.chain}
                    token={token.symbol}
                    className='h-4 w-4'
                  />
                  <span className='text-sm font-medium'>{token.symbol}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className='flex flex-col gap-1'>
        {usdValue && (
          <div className='flex items-center'>
            <span className='text-dark-neutral-200 font-mono text-[12px] leading-[14px] font-medium'>
              {usdValue}
            </span>
          </div>
        )}

        {selectedToken && (
          <div className='flex items-center'>
            <span className='text-dark-neutral-300 text-[11px] font-medium'>
              Available: {formatBalance(selectedToken.balance)}{' '}
              {selectedToken.symbol}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
