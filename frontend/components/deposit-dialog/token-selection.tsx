'use client';

import { DEPOSIT_TOKENS, DepositToken } from '@/lib/constants/deposit-tokens';
import { TokenListItem } from './token-list-item';

interface TokenSelectionProps {
  onTokenSelect: (token: DepositToken) => void;
}

export function TokenSelection({ onTokenSelect }: TokenSelectionProps) {
  return (
    <div className='space-y-3'>
      <p className='text-dark-neutral-400 text-sm font-medium uppercase'>
        Top Tokens
      </p>

      {/* Token List */}
      <div className='space-y-3 overflow-y-auto'>
        {DEPOSIT_TOKENS.map((token, index) => (
          <TokenListItem
            key={`${token.chain}-${token.address}-${index}`}
            symbol={token.symbol}
            name={token.name}
            chain={token.chain}
            onClick={() => onTokenSelect(token)}
          />
        ))}
      </div>
    </div>
  );
}
