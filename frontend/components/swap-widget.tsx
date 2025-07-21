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
    <div className='relative rounded-sm w-full'>
      <div className='absolute border border-[#b49e9e] border-solid inset-0 pointer-events-none rounded-sm' />
      <div className='relative w-full h-full'>
        <div className='box-border flex flex-col gap-3 items-start justify-start pl-4 pr-2.5 py-2 relative w-full h-full'>
          <div className='box-border flex flex-row items-center justify-between p-0 relative shrink-0 w-full'>
            <div className='basis-0 flex flex-col justify-center leading-[0] min-h-px min-w-px not-italic relative shrink-0 text-[#625757] text-base text-left grow font-light'>
              <Input
                type='text'
                value={amount}
                onChange={handleAmountChange}
                placeholder={placeholder}
                disabled={disabled}
                className='border-0 bg-transparent p-0 text-current placeholder:text-current focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 font-mono leading-normal'
              />
            </div>
            
            <div className='box-border flex flex-row gap-2.5 items-center justify-start p-1.5 relative shrink-0'>
              <Button
                onClick={onTokenSelect}
                disabled={disabled}
                variant='ghost'
                className='h-auto p-0 hover:bg-transparent flex flex-col justify-center leading-[0] not-italic relative shrink-0 text-[#786767] text-sm text-left whitespace-nowrap font-medium'
              >
                <p className='block leading-[19px] whitespace-pre'>
                  {selectedToken ? selectedToken.symbol : 'Select Token'}
                </p>
              </Button>
              <ChevronDown className='relative shrink-0 w-5 h-5 text-[#786767]' />
            </div>
          </div>
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
        'bg-gradient-to-b from-[#f0f4f0] to-[#f9f6f6] relative w-80 shrink-0 self-start',
        className,
      )}
    >
      {/* Border overlay */}
      <div className='absolute border border-[#c6b3b2] border-solid inset-0 pointer-events-none' />
      
      <div className='flex flex-col items-center relative w-full h-full'>
        <div className='box-border flex flex-col gap-4 items-center justify-start p-5 relative w-full h-full'>
          
          {/* Header */}
          <div className='box-border flex flex-row items-center justify-between p-0 relative shrink-0 w-full'>
            <div className='flex flex-col justify-center leading-[0] not-italic relative shrink-0 text-[#5c5353] text-xl text-center whitespace-nowrap font-semibold'>
              <p className='block leading-normal whitespace-pre'>Swap</p>
            </div>
            
            <Button
              variant='ghost'
              size='icon'
              className='relative shrink-0 w-8 h-8 p-0 hover:bg-transparent'
              onClick={() => console.log('Settings clicked')}
              disabled={!isSwapSupported}
            >
              <Settings className='w-8 h-8 text-[#8e7777]' />
            </Button>
          </div>

          {/* Token inputs */}
          <div className='box-border flex flex-col gap-2.5 items-center justify-start p-0 relative shrink-0 w-full'>
            <TokenInput
              amount={swapState.fromAmount}
              onAmountChange={handleFromAmountChange}
              selectedToken={swapState.fromToken}
              onTokenSelect={handleTokenSelect}
              disabled={!isSwapSupported}
              placeholder='0'
            />

            {/* Arrow down */}
            <div className='relative shrink-0 w-5 h-5'>
              <ArrowDown className='w-5 h-5 text-[#8e7777]' />
            </div>

            <TokenInput
              amount={swapState.toAmount}
              onAmountChange={handleToAmountChange}
              selectedToken={swapState.toToken}
              onTokenSelect={handleTokenSelect}
              disabled={!isSwapSupported}
              placeholder='0'
            />
          </div>

          {/* Swap button - exact Figma implementation */}
          <div className='bg-[#f2ddc4] relative rounded-sm shrink-0 w-full'>
            <div className='flex flex-row items-center justify-center overflow-hidden relative w-full h-full'>
              <Button
                onClick={handleSwap}
                disabled={isSwapDisabled}
                className='box-border flex flex-row gap-1.5 items-center justify-center px-[18px] py-3 relative w-full bg-transparent hover:bg-transparent border-0'
              >
                <div className='box-border flex flex-row items-center justify-center px-0.5 py-0 relative shrink-0'>
                  <div className='font-semibold leading-[0] not-italic relative shrink-0 text-[#786767] text-base text-left whitespace-nowrap'>
                    <p className='block leading-6 whitespace-pre'>Swap</p>
                  </div>
                </div>
              </Button>
            </div>
            <div className='absolute border border-[#786767] border-solid inset-0 pointer-events-none rounded-sm' />
          </div>

        </div>
      </div>
    </div>
  );
}
