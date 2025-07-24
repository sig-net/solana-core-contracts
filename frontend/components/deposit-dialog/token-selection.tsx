'use client';

import { CryptoIcon } from '@/components/balance-display/crypto-icon';
import { cn } from '@/lib/utils';
import { DEPOSIT_TOKENS, DepositToken } from '@/lib/constants/deposit-tokens';

interface TokenSelectionProps {
  onTokenSelect: (token: DepositToken) => void;
  selectedToken?: DepositToken;
}

export function TokenSelection({
  onTokenSelect,
  selectedToken,
}: TokenSelectionProps) {
  return (
    <div className='space-y-3'>
      <p className='text-dark-neutral-400 text-sm font-medium'>
        Select a token to deposit into your account
      </p>

      {/* Token List */}
      <div className='max-h-96 space-y-3 overflow-y-auto'>
        {DEPOSIT_TOKENS.map((token, index) => (
          <button
            key={`${token.chain}-${token.address}-${index}`}
            onClick={() => onTokenSelect(token)}
            className={cn(
              'group flex w-full cursor-pointer items-center gap-4 rounded-sm border p-4 text-left transition-all hover:shadow-sm',
              selectedToken?.address === token.address &&
                selectedToken?.chain === token.chain
                ? 'border-dark-neutral-400 bg-brand-100/20 shadow-sm'
                : 'border-dark-neutral-50 hover:border-dark-neutral-200 hover:bg-pastels-polar-100/30',
            )}
          >
            <CryptoIcon
              chain={token.chain}
              token={token.symbol}
              className='h-10 w-10 shrink-0'
            />
            <div className='min-w-0 flex-1'>
              <div className='flex items-center justify-between gap-3'>
                <div>
                  <h4 className='text-tundora-300 text-base font-semibold'>
                    {token.symbol}
                  </h4>
                  <p className='text-tundora-50 text-sm font-medium'>
                    {token.name}
                  </p>
                </div>
                <span className='text-dark-neutral-400 bg-pastels-polar-200 border-dark-neutral-50 rounded-sm border px-2.5 py-1.5 text-xs font-medium'>
                  {token.chainName}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
