'use client';

import {
  SUPPORTED_TOKENS,
  TokenMetadata,
} from '@/lib/constants/token-metadata';

import { TokenListItem } from './token-list-item';

interface TokenSelectionProps {
  onTokenSelect: (token: TokenMetadata) => void;
}

export function TokenSelection({ onTokenSelect }: TokenSelectionProps) {
  return (
    <div className='space-y-3'>
      <p className='text-dark-neutral-400 text-sm font-medium uppercase'>
        Top Tokens
      </p>

      {/* Token List */}
      <div className='space-y-3 overflow-y-auto'>
        {SUPPORTED_TOKENS.map((token, index) => (
          <TokenListItem
            key={`${token.chain}-${token.address}-${index}`}
            symbol={token.symbol}
            name={token.name}
            chain={token.chain}
            chainName={token.chainName}
            onClick={() => onTokenSelect(token)}
          />
        ))}
      </div>
    </div>
  );
}
