import { WalletIcon } from 'lucide-react';

import { TruncatedText } from '@/components/ui/truncated-text';

import { CryptoIcon } from '../balance-display/crypto-icon';

interface TokenDisplayProps {
  token?: {
    symbol: string;
    chain: string;
    amount: string;
    usdValue: string;
  };
}

export function TokenDisplay({ token }: TokenDisplayProps) {
  if (!token) return null;

  // Special case for wallet addresses
  if (token.symbol === 'WALLET') {
    return (
      <div className='flex min-w-0 items-center gap-2 sm:gap-4'>
        <WalletIcon className='text-tundora-50 h-4 w-4 flex-shrink-0 sm:h-5 sm:w-5' />
        <div className='flex min-w-0 flex-col gap-1'>
          <div className='text-xs font-medium text-stone-600 sm:text-sm'>
            <TruncatedText
              text={token.amount}
              prefixLength={4}
              suffixLength={3}
              copyable={true}
              className='transition-colors hover:text-blue-600'
            />
          </div>
          <div className='text-xs font-semibold text-stone-400'>Wallet</div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex min-w-0 items-center gap-2 sm:gap-4'>
      <div className='flex-shrink-0'>
        <CryptoIcon chain={token.chain} token={token.symbol} />
      </div>
      <div className='flex min-w-0 flex-col gap-1'>
        <div className='truncate text-xs font-medium text-stone-600 sm:text-sm'>
          {token.amount}
        </div>
        <div className='truncate text-xs font-semibold text-stone-400'>
          {token.usdValue}
        </div>
      </div>
    </div>
  );
}
