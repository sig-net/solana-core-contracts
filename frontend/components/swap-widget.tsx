'use client';

import { useState } from 'react';
import { ChevronDown, ArrowDown, Settings } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { TokenMetadata } from '@/lib/constants/token-metadata';

// TypeScript interfaces for the component
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

// Token Input Component matching Figma design
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
    // Allow only numbers and single decimal point
    if (/^\d*\.?\d*$/.test(value)) {
      onAmountChange(value);
    }
  };

  return (
    <div
      className={cn(
        'rounded-[2px] border border-[#B49E9E] p-5 bg-transparent',
        error && 'border-red-500',
      )}
    >
      <div className='flex items-center justify-between gap-3'>
        <div className='flex-1'>
          <Input
            type='text'
            value={amount}
            onChange={handleAmountChange}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              'border-0 bg-transparent p-0 text-[24px] font-light text-[#625757] placeholder:text-[#625757] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0',
              'font-mono leading-[36px]', // Test Söhne Mono equivalent with proper line height
            )}
            style={{ fontWeight: 300 }}
          />
        </div>

        <div className='rounded-md bg-white px-[10px] py-[10px] border border-gray-200'>
          <Button
            onClick={onTokenSelect}
            disabled={disabled}
            variant='ghost'
            className={cn(
              'h-auto p-0 text-[#625757] hover:bg-transparent flex items-center gap-2',
              !selectedToken && 'text-[#625757]',
            )}
          >
            <span className='text-sm font-medium'>
              {selectedToken ? selectedToken.symbol : 'Select'}
            </span>
            <ChevronDown className='h-4 w-4' />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SwapWidget({
  className,
  onSwap,
  onTokenSelect,
  loading = false,
  error = null,
}: SwapWidgetProps) {
  const [swapState, setSwapState] = useState<SwapState>({
    fromToken: null,
    toToken: null,
    fromAmount: '',
    toAmount: '',
    isSwapping: false,
  });

  const handleFromAmountChange = (amount: string) => {
    setSwapState(prev => ({ ...prev, fromAmount: amount }));
    // TODO: Calculate toAmount based on exchange rate
  };

  const handleToAmountChange = (amount: string) => {
    setSwapState(prev => ({ ...prev, toAmount: amount }));
    // TODO: Calculate fromAmount based on exchange rate
  };

  const handleTokenSelect = (side: 'from' | 'to') => {
    // For now, just cycle through available tokens or implement a dropdown
    console.log(`Token select for ${side} side`);
    onTokenSelect?.(null, side);
  };

  const handleSwapDirection = () => {
    setSwapState(prev => ({
      ...prev,
      fromToken: prev.toToken,
      toToken: prev.fromToken,
      fromAmount: prev.toAmount,
      toAmount: prev.fromAmount,
    }));
  };

  const handleSwap = () => {
    if (!swapState.fromToken || !swapState.toToken || !swapState.fromAmount) {
      return;
    }

    setSwapState(prev => ({ ...prev, isSwapping: true }));
    onSwap?.(
      swapState.fromToken,
      swapState.toToken,
      swapState.fromAmount,
      swapState.toAmount,
    );
  };

  const isSwapDisabled =
    !swapState.fromToken ||
    !swapState.toToken ||
    !swapState.fromAmount ||
    loading ||
    swapState.isSwapping;

  return (
    <div
      className={cn(
        'w-[413px] rounded-2xl border-[0.5px] border-[#C6B3B2] bg-gradient-to-b from-[#F0F4F0] to-[#F9F6F6] p-10',
        'flex flex-col items-center gap-5',
        className,
      )}
    >
      {/* Header section matching Frame 37 */}
      <div className='flex w-full items-center justify-between'>
        <h2
          className='text-xl font-semibold text-[#5C5353]'
          style={{
            fontSize: '20px',
            fontWeight: 600,
            fontFamily: 'var(--)', // Using Elza Text equivalent
          }}
        >
          Swap
        </h2>

        <Button
          variant='ghost'
          size='icon'
          className='h-8 w-8 p-0 hover:bg-transparent'
          onClick={() => console.log('Settings clicked')}
        >
          <Settings className='h-8 w-8 stroke-[#8E7777]' strokeWidth={1.5} />
        </Button>
      </div>

      {/* Token input sections */}
      <div className='w-full space-y-5'>
        <TokenInput
          amount={swapState.fromAmount}
          onAmountChange={handleFromAmountChange}
          selectedToken={swapState.fromToken}
          onTokenSelect={() => handleTokenSelect('from')}
          disabled={loading}
          placeholder='0'
        />

        {/* Arrow down icon between sections */}
        <div className='flex justify-center'>
          <Button
            onClick={handleSwapDirection}
            variant='ghost'
            size='icon'
            className='h-8 w-8 p-0 hover:bg-transparent'
            disabled={loading}
          >
            <ArrowDown className='h-8 w-8 fill-[#8E7777] stroke-none' />
          </Button>
        </div>

        <TokenInput
          amount={swapState.toAmount}
          onAmountChange={handleToAmountChange}
          selectedToken={swapState.toToken}
          onTokenSelect={() => handleTokenSelect('to')}
          disabled={loading}
          placeholder='0'
        />
      </div>

      {/* Error message */}
      {error && (
        <div className='w-full text-center text-sm text-red-500'>{error}</div>
      )}

      {/* Swap button */}
      <Button
        onClick={handleSwap}
        disabled={isSwapDisabled}
        className={cn(
          'w-full h-[58px] rounded-md border border-[#D5C4BB] bg-[#F5F0EE] text-[#D5C4BB] hover:bg-[#F5F0EE]/90',
          'text-lg font-semibold',
          !isSwapDisabled &&
            'bg-[#5C5353] text-white border-[#5C5353] hover:bg-[#5C5353]/90',
        )}
        style={{
          fontSize: '18px',
          fontWeight: 600,
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {swapState.isSwapping ? 'Swapping...' : 'Swap'}
      </Button>
    </div>
  );
}
