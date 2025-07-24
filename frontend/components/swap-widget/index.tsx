'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { TokenMetadata } from '@/lib/constants/token-metadata';
import { SwapHeader } from './swap-header';
import { TokenInputField } from './token-input-field';
import { ArrowDown } from 'lucide-react';
import { Button } from '../ui/button';

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
  const [swapState] = useState<SwapState>({
    fromToken: null,
    toToken: null,
    fromAmount: '',
    toAmount: '',
    isSwapping: false,
  });

  const isSwapSupported = false;

  const handleFromAmountChange = () => {};

  const handleToAmountChange = () => {};

  const handleTokenSelect = () => {};

  const handleSwap = () => {};

  const isSwapDisabled = true;

  return (
    <div
      className={cn(
        'border-dark-neutral-50 gradient-bg-swap relative w-full shrink-0 space-y-4 self-start border p-8 md:w-fit',
        className,
      )}
    >
      <SwapHeader onSettingsClick={() => console.log('Settings clicked')} />

      <div className='flex flex-col items-center gap-4'>
        <TokenInputField
          amount={swapState.fromAmount}
          onAmountChange={handleFromAmountChange}
          selectedToken={swapState.fromToken}
          onTokenSelect={handleTokenSelect}
          placeholder='0'
        />

        <ArrowDown className='text-dark-neutral-300 h-5 w-5' />

        <TokenInputField
          amount={swapState.toAmount}
          onAmountChange={handleToAmountChange}
          selectedToken={swapState.toToken}
          onTokenSelect={handleTokenSelect}
          placeholder='0'
        />
      </div>

      <Button
        onClick={handleSwap}
        variant='disabled'
        size='lg'
        className='w-full'
      >
        Swap
      </Button>
    </div>
  );
}
