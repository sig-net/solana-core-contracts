'use client';

import { useState } from 'react';
import { ArrowDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  TokenMetadata,
  SUPPORTED_TOKENS,
} from '@/lib/constants/token-metadata';
import {
  TokenAmountDisplay,
  Token,
} from '@/components/ui/token-amount-display';

import { Button } from '../ui/button';

import { SwapHeader } from './swap-header';

interface SwapWidgetProps {
  className?: string;
  availableTokens?: TokenMetadata[];
  onSwap?: (
    fromToken: TokenMetadata | null,
    toToken: TokenMetadata | null,
    fromAmount: string,
    toAmount: string,
  ) => void;
  onTokenSelect?: (token: TokenMetadata | null, side: 'from' | 'to') => void;
  loading?: boolean;
  error?: string | null;
}

interface SwapState {
  fromToken: TokenMetadata | null;
  toToken: TokenMetadata | null;
  fromAmount: string;
  toAmount: string;
  isSwapping: boolean;
}

export function SwapWidget({ className }: Pick<SwapWidgetProps, 'className'>) {
  const [swapState, setSwapState] = useState<SwapState>({
    fromToken: null,
    toToken: null,
    fromAmount: '',
    toAmount: '',
    isSwapping: false,
  });

  // Helper function to convert TokenMetadata to Token
  const tokenMetadataToToken = (tokenMetadata: TokenMetadata): Token => ({
    symbol: tokenMetadata.symbol,
    name: tokenMetadata.name,
    chain: 'ethereum' as const,
    address: tokenMetadata.address,
    balance: '0', // Placeholder - in real app you'd fetch actual balance
    decimals: tokenMetadata.decimals,
  });

  // Helper function to convert Token to TokenMetadata
  const tokenToTokenMetadata = (token: Token): TokenMetadata | null => {
    return SUPPORTED_TOKENS.find(t => t.symbol === token.symbol) || null;
  };

  // Convert supported tokens
  const supportedTokens: Token[] = SUPPORTED_TOKENS.map(tokenMetadataToToken);

  const handleFromAmountChange = (amount: string) => {
    setSwapState(prev => ({ ...prev, fromAmount: amount }));
  };

  const handleToAmountChange = (amount: string) => {
    setSwapState(prev => ({ ...prev, toAmount: amount }));
  };

  const handleFromTokenSelect = (token: Token) => {
    const tokenMetadata = tokenToTokenMetadata(token);
    setSwapState(prev => ({ ...prev, fromToken: tokenMetadata }));
  };

  const handleToTokenSelect = (token: Token) => {
    const tokenMetadata = tokenToTokenMetadata(token);
    setSwapState(prev => ({ ...prev, toToken: tokenMetadata }));
  };

  const handleSwap = () => {};

  return (
    <div
      className={cn(
        'border-dark-neutral-50 gradient-bg-swap relative w-full max-w-full shrink-0 space-y-6 self-start border p-4 sm:p-6 lg:max-w-sm lg:p-8',
        className,
      )}
    >
      <SwapHeader onSettingsClick={() => {
        // TODO: Implement settings functionality
      }} />

      <div className='flex flex-col gap-4'>
        <TokenAmountDisplay
          value={swapState.fromAmount}
          onChange={handleFromAmountChange}
          tokens={supportedTokens}
          selectedToken={
            swapState.fromToken
              ? tokenMetadataToToken(swapState.fromToken)
              : undefined
          }
          onTokenSelect={handleFromTokenSelect}
          placeholder='0'
          width='w-full'
          disabled={true}
        />

        <div className='flex justify-center'>
          <ArrowDown className='text-dark-neutral-300 h-5 w-5' />
        </div>

        <TokenAmountDisplay
          value={swapState.toAmount}
          onChange={handleToAmountChange}
          tokens={supportedTokens}
          selectedToken={
            swapState.toToken
              ? tokenMetadataToToken(swapState.toToken)
              : undefined
          }
          onTokenSelect={handleToTokenSelect}
          placeholder='0'
          width='w-full'
          disabled={true}
        />
      </div>

      <Button
        onClick={handleSwap}
        disabled
        variant='secondary'
        size='lg'
        className='w-full'
      >
        Swap
      </Button>
    </div>
  );
}
