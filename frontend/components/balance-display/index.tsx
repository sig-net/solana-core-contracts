'use client';

import { useState } from 'react';
import { formatUnits } from 'viem';

import { cn, calculateUsdValue, formatUsdValue } from '@/lib/utils';
import { DepositDialog } from '@/components/deposit-dialog';
import { WithdrawDialog, WithdrawToken } from '@/components/withdraw-dialog';
import { useTokenPrices } from '@/hooks/use-token-prices';

import { BalanceBox } from './balance-box';
import { CryptoIcon } from './crypto-icon';
import { BalancesSectionHeader } from './balance-section-header';

interface Token {
  balance: bigint;
  token: string;
  chain: string;
  decimals: number;
  erc20Address: string;
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

  // Get unique token symbols for price fetching
  const tokenSymbols = [...new Set(tokens.map(token => token.token))];
  const { data: tokenPrices } = useTokenPrices(tokenSymbols);

  // Convert tokens to withdraw format
  const withdrawTokens: WithdrawToken[] = tokens.map(token => {
    const formattedBalance = formatUnits(token.balance, token.decimals);

    return {
      symbol: token.token,
      name: token.token, // In a real app, you'd have a mapping
      chain: token.chain as 'ethereum' | 'solana',
      chainName:
        token.chain === 'ethereum' ? 'Ethereum Sepolia' : 'Solana Devnet',
      address: token.erc20Address, // Use the actual ERC20 address
      balance: formattedBalance,
      decimals: token.decimals,
    };
  });

  return (
    <div className='flex w-full max-w-full flex-col gap-5'>
      <BalancesSectionHeader
        onDepositClick={() => setIsDepositDialogOpen(true)}
      />
      <div
        className={cn(
          'grid w-full max-w-full gap-4 sm:gap-6 md:grid-cols-2 md:gap-8 lg:gap-10',
          className,
        )}
      >
        {tokens.map((tokenData, index) => {
          const formattedBalance = formatUnits(
            tokenData.balance,
            tokenData.decimals,
          );
          const displayAmount = parseFloat(formattedBalance).toFixed(1);

          // Calculate USD value
          const tokenPrice = tokenPrices?.[tokenData.token.toUpperCase()];
          const usdValue = tokenPrice
            ? calculateUsdValue(
                tokenData.balance.toString(),
                tokenData.decimals,
                tokenPrice.usd,
              )
            : 0;
          const formattedUsdValue = formatUsdValue(usdValue);

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
              usdValue={formattedUsdValue}
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
