'use client';

import { useState } from 'react';
import { formatUnits } from 'viem';

import { cn } from '@/lib/utils';
import { DepositDialog } from '@/components/deposit-dialog';
import { WithdrawDialog, WithdrawToken } from '@/components/withdraw-dialog';

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
}

export function BalanceDisplay({
  tokens,
  className = '',
}: BalanceDisplayProps) {
  const [isDepositDialogOpen, setIsDepositDialogOpen] = useState(false);
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);
  const [selectedTokenForWithdraw, setSelectedTokenForWithdraw] =
    useState<WithdrawToken | null>(null);

  // Convert tokens to withdraw format
  const withdrawTokens: WithdrawToken[] = tokens.map(token => {
    const formattedBalance = formatUnits(token.balance, token.decimals);

    return {
      symbol: token.token,
      name: token.token, // In a real app, you'd have a mapping
      chain: token.chain as 'ethereum' | 'solana',
      chainName:
        token.chain === 'ethereum' ? 'Ethereum Sepolia' : 'Solana Devnet',
      address: '0x...', // Mock address
      balance: formattedBalance,
      decimals: token.decimals,
    };
  });

  return (
    <div className='flex flex-col gap-5'>
      <BalancesSectionHeader
        onDepositClick={() => setIsDepositDialogOpen(true)}
      />
      <div className={cn('grid md:grid-cols-2 gap-10 w-full', className)}>
        {tokens.map((tokenData, index) => {
          const formattedBalance = formatUnits(
            tokenData.balance,
            tokenData.decimals,
          );
          const displayAmount = parseFloat(formattedBalance).toFixed(1);

          // Find corresponding withdraw token
          const withdrawToken = withdrawTokens.find(
            wt => wt.symbol === tokenData.token && wt.chain === tokenData.chain,
          );

          const handleSendClick = () => {
            if (withdrawToken) {
              setSelectedTokenForWithdraw(withdrawToken);
              setIsWithdrawDialogOpen(true);
            }
          };

          return (
            <BalanceBox
              key={`${tokenData.chain}-${tokenData.token}-${index}`}
              amount={displayAmount}
              usdValue='$5387.89'
              tokenSymbol={tokenData.token}
              icon={
                <CryptoIcon chain={tokenData.chain} token={tokenData.token} />
              }
              onSendClick={handleSendClick}
              onSwapClick={() => {
                // TODO: Implement swap functionality
                console.log('Swap clicked for', tokenData.token);
              }}
            />
          );
        })}
      </div>

      <DepositDialog
        open={isDepositDialogOpen}
        onOpenChange={setIsDepositDialogOpen}
      />

      <WithdrawDialog
        open={isWithdrawDialogOpen}
        onOpenChange={open => {
          setIsWithdrawDialogOpen(open);
          if (!open) {
            setSelectedTokenForWithdraw(null);
          }
        }}
        availableTokens={withdrawTokens}
        preSelectedToken={selectedTokenForWithdraw}
      />
    </div>
  );
}
