'use client';

import { ChevronDown } from 'lucide-react';
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
      className={`bg-pastels-swiss-coffee-200 border-dark-neutral-400/80 flex flex-col gap-3 rounded-xs border p-5 ${className}`}
    >
      <div className='flex w-full items-center justify-between gap-3'>
        <div className='flex flex-1 items-center gap-2'>
          <input
            type='text'
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className='text-dark-neutral-500 w-full border-none bg-transparent text-xl outline-none'
          />
          {selectedToken && (
            <button
              type='button'
              onClick={handleMaxClick}
              className='text-dark-neutral-300 hover:text-dark-neutral-400 shrink-0 text-xs font-medium underline decoration-dotted underline-offset-2'
            >
              max
            </button>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className='bg-pastels-pampas-500 border-dark-neutral-50 text-dark-neutral-400 flex shrink-0 items-center gap-3 rounded-xs border px-2 py-1 font-medium'>
              {selectedToken ? (
                <>
                  <CryptoIcon
                    chain={selectedToken.chain}
                    token={selectedToken.symbol}
                    className='size-4'
                  />
                  <span>{selectedToken.symbol}</span>
                </>
              ) : (
                <span>Select Token</span>
              )}
              <ChevronDown className='text-dark-neutral-400 size-4' />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align='end'
            className='w-[120px] min-w-0 space-y-1 rounded-xs'
          >
            {tokens.map((token, index) => (
              <DropdownMenuItem
                key={`${token.chain}-${token.address}-${index}`}
                onClick={() => onTokenSelect(token)}
                className='text-dark-neutral-400 flex cursor-pointer items-center gap-3 rounded-xs px-1 py-0 font-medium'
              >
                <CryptoIcon
                  chain={token.chain}
                  token={token.symbol}
                  className='size-4'
                />
                <span>{token.symbol}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className='flex flex-col gap-1'>
        {usdValue && (
          <div className='flex items-center'>
            <span className='text-dark-neutral-200 text-[12px] leading-[14px] font-medium'>
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
