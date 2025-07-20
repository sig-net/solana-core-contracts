'use client';

import { useState } from 'react';
import { ChevronDown, ArrowDown, Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { TokenMetadata } from '@/lib/constants/token-metadata';

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

interface TokenInputProps {
  amount: string;
  onAmountChange: (amount: string) => void;
  selectedToken: TokenMetadata | null;
  onTokenSelect: () => void;
  disabled?: boolean;
  error?: boolean;
  placeholder?: string;
}

interface SwapState {
  fromToken: TokenMetadata | null;
  toToken: TokenMetadata | null;
  fromAmount: string;
  toAmount: string;
  isSwapping: boolean;
}

function TokenInput({
  amount,
  onAmountChange,
  selectedToken,
  onTokenSelect,
  disabled = false,
  error = false,
  placeholder = '0',
}: TokenInputProps) {
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    if (/^\d*\.?\d*$/.test(value)) {
      onAmountChange(value);
    }
  };

  return (
    <div
      className={cn(
        'rounded-sm border border-dark-neutral-100 p-5 bg-transparent relative',
        error && 'border-destructive',
      )}
    >
      <div className='flex items-center justify-between'>
        <div className='flex-1'>
          <Input
            type='text'
            value={amount}
            onChange={handleAmountChange}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              'border-0 bg-transparent p-0 text-2xl text-dark-neutral-500 placeholder:text-dark-neutral-500',
              'focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0',
              'font-mono leading-[1.5] font-light',
            )}
            style={{ fontWeight: 300 }}
          />
        </div>

        <div className='flex items-center gap-2.5 p-2.5'>
          <Button
            onClick={onTokenSelect}
            disabled={disabled}
            variant='ghost'
            className={cn(
              'h-auto p-0 text-dark-neutral-400 hover:bg-transparent flex items-center gap-2.5 text-base font-medium',
              !selectedToken && 'text-dark-neutral-400',
            )}
          >
            <span className='whitespace-pre leading-[19px]'>
              {selectedToken ? selectedToken.symbol : 'Select Token'}
            </span>
            <ChevronDown className='h-5 w-5' />
          </Button>
        </div>
      </div>
    </div>
  );
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
        'relative bg-gradient-to-b from-pastels-green-white-200 to-pastels-mercury-100',
        'border-[0.5px] border-dark-neutral-50 flex flex-col items-center',
        className,
      )}
    >
      <div className='flex flex-col gap-5 items-center justify-start p-10 w-full'>
        {/* Header section matching Figma exactly */}
        <div className='flex items-center justify-between w-full'>
          <h2 className='text-xl font-semibold text-tundora-400 leading-normal'>
            Swap
          </h2>

          <Button
            variant='ghost'
            size='icon'
            className='h-8 w-8 p-0 hover:bg-transparent'
            onClick={() => console.log('Settings clicked')}
            disabled={!isSwapSupported}
          >
            <Settings
              className='h-8 w-8 stroke-dark-neutral-300'
              strokeWidth={1.5}
            />
          </Button>
        </div>

        {/* Token input sections */}
        <div className='w-full'>
          <TokenInput
            amount={swapState.fromAmount}
            onAmountChange={handleFromAmountChange}
            selectedToken={swapState.fromToken}
            onTokenSelect={handleTokenSelect}
            disabled={!isSwapSupported}
            placeholder='0'
          />
        </div>

        {/* Arrow down icon between sections */}
        <div className='flex justify-center'>
          <ArrowDown className='h-8 w-8 text-dark-neutral-300' />
        </div>

        <div className='flex flex-col gap-1.5 items-center justify-start w-full'>
          <TokenInput
            amount={swapState.toAmount}
            onAmountChange={handleToAmountChange}
            selectedToken={swapState.toToken}
            onTokenSelect={handleTokenSelect}
            disabled={!isSwapSupported}
            placeholder='0'
          />
        </div>

        {/* Disabled swap button exactly matching Figma */}
        <div className='bg-disabled-bg relative rounded-sm w-full'>
          <Button
            onClick={handleSwap}
            disabled={isSwapDisabled}
            className={cn(
              'w-full rounded-sm border border-disabled-text bg-transparent text-disabled-text hover:bg-transparent',
              'flex items-center justify-center px-[18px] py-3 gap-1.5',
              'text-sm font-medium leading-5',
            )}
          >
            Button CTA
          </Button>
        </div>
      </div>
    </div>
  );
}
