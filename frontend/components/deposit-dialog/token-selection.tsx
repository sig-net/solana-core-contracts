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
      <p className='text-sm text-dark-neutral-400 font-medium'>
        Select a token to deposit into your account
      </p>

      {/* Token List */}
      <div className='space-y-3 max-h-96 overflow-y-auto'>
        {DEPOSIT_TOKENS.map((token, index) => (
          <button
            key={`${token.chain}-${token.address}-${index}`}
            onClick={() => onTokenSelect(token)}
            className={cn(
              'w-full flex items-center gap-4 p-4 rounded-sm border transition-all text-left group hover:shadow-sm cursor-pointer',
              selectedToken?.address === token.address &&
                selectedToken?.chain === token.chain
                ? 'border-dark-neutral-400 bg-brand-100/20 shadow-sm'
                : 'border-dark-neutral-50 hover:border-dark-neutral-200 hover:bg-pastels-polar-100/30',
            )}
          >
            <CryptoIcon
              chain={token.chain}
              token={token.symbol}
              className='shrink-0 w-10 h-10'
            />
            <div className='flex-1 min-w-0'>
              <div className='flex items-center justify-between gap-3'>
                <div>
                  <h4 className='font-semibold text-tundora-300 text-base'>
                    {token.symbol}
                  </h4>
                  <p className='text-sm text-tundora-50 font-medium'>
                    {token.name}
                  </p>
                </div>
                <span className='text-xs font-medium text-dark-neutral-400 bg-pastels-polar-200 px-2.5 py-1.5 rounded-sm border border-dark-neutral-50'>
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
