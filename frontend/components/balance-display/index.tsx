'use client';

import { formatUnits } from 'viem';

import { cn } from '@/lib/utils';

import { BalanceBox } from './balance-box';
import { CryptoIcon } from './crypto-icon';

interface BalanceDisplayProps {
  balance?: bigint;
  symbol?: string;
  decimals?: number;
  className?: string;
}

export function BalanceDisplay({
  balance = BigInt(0),
  symbol: _symbol = 'SOL',
  decimals = 9,
  className,
}: BalanceDisplayProps) {
  const formattedBalance = formatUnits(balance, decimals);
  const displayAmount = parseFloat(formattedBalance).toFixed(1);

  return (
    <div className={cn('flex items-stretch gap-[42px] w-full', className)}>
      <BalanceBox
        amount={displayAmount || '1.8'}
        usdValue='$5387.89'
        tokenSymbol='SOL'
        icon={<CryptoIcon chain='solana' token='SOL' />}
      />

      <BalanceBox
        amount='1.8'
        usdValue='$5387.89'
        tokenSymbol='ETH'
        icon={<CryptoIcon chain='ethereum' token='ETH' />}
      />
    </div>
  );
}
