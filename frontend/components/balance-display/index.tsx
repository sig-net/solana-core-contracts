'use client';

import { formatUnits } from 'viem';

import { cn } from '@/lib/utils';

import { BalanceBox } from './balance-box';
import { CryptoIcon } from './crypto-icon';
import { BalancesSectionHeader } from './balance-section-header';

interface Token {
  balance: bigint;
  token: string;
  chain: string;
  decimals: number;
}

interface BalanceDisplayProps {
  tokens: Token[];
  className?: string;
  onDepositClick?: () => void;
}

export function BalanceDisplay({
  tokens,
  className = '',
  onDepositClick,
}: BalanceDisplayProps) {
  return (
    <div className='flex flex-col gap-5'>
      <BalancesSectionHeader onDepositClick={onDepositClick} />
      <div className={cn('grid md:grid-cols-2 gap-10 w-full', className)}>
        {tokens.map((tokenData, index) => {
          const formattedBalance = formatUnits(
            tokenData.balance,
            tokenData.decimals,
          );
          const displayAmount = parseFloat(formattedBalance).toFixed(1);

          return (
            <BalanceBox
              key={`${tokenData.chain}-${tokenData.token}-${index}`}
              amount={displayAmount}
              usdValue='$5387.89'
              tokenSymbol={tokenData.token}
              icon={
                <CryptoIcon chain={tokenData.chain} token={tokenData.token} />
              }
            />
          );
        })}
      </div>
    </div>
  );
}
