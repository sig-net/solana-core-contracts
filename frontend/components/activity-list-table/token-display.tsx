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
      <div className='flex items-center gap-4'>
        <WalletIcon className='text-tundora-50 h-8 w-8' />
        <div className='flex flex-col gap-1'>
          <div className='text-sm font-medium text-stone-600'>
            <TruncatedText
              text={token.amount}
              prefixLength={6}
              suffixLength={4}
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
    <div className='flex items-center gap-4'>
      <CryptoIcon chain={token.chain} token={token.symbol} />
      <div className='flex flex-col gap-1'>
        <div className='text-sm font-medium text-stone-600'>{token.amount}</div>
        <div className='text-xs font-semibold text-stone-400'>
          {token.usdValue}
        </div>
      </div>
    </div>
  );
}
