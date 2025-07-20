'use client';

import { CryptoIcon } from '@/components/balance-display/crypto-icon';
import { DepositToken } from '@/lib/constants/deposit-tokens';

interface LoadingStateProps {
  token: DepositToken;
}

export function LoadingState({ token }: LoadingStateProps) {
  return (
    <div className='space-y-6 text-center'>
      {/* Token Info */}
      <div className='flex flex-col items-center gap-4'>
        <CryptoIcon
          chain={token.chain}
          token={token.symbol}
          className='w-12 h-12'
        />
        <div>
          <h3 className='font-semibold text-tundora-300 text-lg mb-1'>
            Generating Deposit Address
          </h3>
          <p className='text-sm text-tundora-50 font-medium'>
            {token.symbol} on {token.chainName}
          </p>
        </div>
      </div>

      {/* Loading Animation */}
      <div className='flex justify-center'>
        <div className='flex gap-1'>
          <div className='w-2 h-2 bg-dark-neutral-300 rounded-full animate-bounce'></div>
          <div
            className='w-2 h-2 bg-dark-neutral-300 rounded-full animate-bounce'
            style={{ animationDelay: '0.1s' }}
          ></div>
          <div
            className='w-2 h-2 bg-dark-neutral-300 rounded-full animate-bounce'
            style={{ animationDelay: '0.2s' }}
          ></div>
        </div>
      </div>

      {/* Status Text */}
      <p className='text-sm text-dark-neutral-400 font-medium'>
        Please wait while we generate your unique deposit address...
      </p>
    </div>
  );
}
