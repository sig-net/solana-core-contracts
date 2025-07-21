'use client';

import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CryptoIcon } from '@/components/balance-display/crypto-icon';
import { cn } from '@/lib/utils';

import { WithdrawToken } from './index';

interface AmountInputProps {
  availableTokens: WithdrawToken[];
  onSubmit: (data: {
    token: WithdrawToken;
    amount: string;
    receiverAddress: string;
  }) => void;
  preSelectedToken?: WithdrawToken | null;
}

export function AmountInput({
  availableTokens,
  onSubmit,
  preSelectedToken,
}: AmountInputProps) {
  const [selectedToken, setSelectedToken] = useState<WithdrawToken | null>(
    preSelectedToken || availableTokens[0] || null,
  );
  const [amount, setAmount] = useState('');
  const [receiverAddress, setReceiverAddress] = useState('');
  const [showTokenDropdown, setShowTokenDropdown] = useState(false);
  const [errors, setErrors] = useState<{
    amount?: string;
    receiverAddress?: string;
  }>({});

  // Update selected token when preSelectedToken changes
  useEffect(() => {
    if (preSelectedToken) {
      setSelectedToken(preSelectedToken);
    }
  }, [preSelectedToken]);

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!amount || parseFloat(amount) <= 0) {
      newErrors.amount = 'Enter a valid amount';
    } else if (
      selectedToken &&
      parseFloat(amount) > parseFloat(selectedToken.balance)
    ) {
      newErrors.amount = 'Insufficient balance';
    }

    if (!receiverAddress.trim()) {
      newErrors.receiverAddress = 'Enter receiver address';
    } else if (!receiverAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      newErrors.receiverAddress = 'Must be a valid Ethereum address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!selectedToken || !validateForm()) return;

    onSubmit({
      token: selectedToken,
      amount,
      receiverAddress,
    });
  };

  const handleMaxClick = () => {
    if (selectedToken) {
      setAmount(selectedToken.balance);
    }
  };

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    if (num === 0) return '0';
    if (num < 0.01) return '< 0.01';
    return num.toFixed(6).replace(/\.?0+$/, '');
  };

  return (
    <div className='space-y-4'>
      {/* Token Selection */}
      <div className='space-y-2'>
        <Label className='text-sm font-medium text-tundora-300'>Token</Label>
        <div className='relative'>
          <button
            onClick={() => setShowTokenDropdown(!showTokenDropdown)}
            className='w-full flex items-center justify-between p-3 bg-pastels-polar-200 border border-dark-neutral-50 rounded-sm hover:border-dark-neutral-200 hover:bg-pastels-polar-100/30 transition-all focus-visible:ring-2 focus-visible:ring-dark-neutral-200 focus-visible:ring-offset-2 cursor-pointer'
          >
            {selectedToken ? (
              <div className='flex items-center gap-3'>
                <CryptoIcon
                  chain={selectedToken.chain}
                  token={selectedToken.symbol}
                  className='w-8 h-8'
                />
                <div className='text-left'>
                  <div className='font-semibold text-tundora-300'>
                    {selectedToken.symbol}
                  </div>
                  <div className='text-sm text-dark-neutral-400'>
                    Balance: {formatBalance(selectedToken.balance)}
                  </div>
                </div>
              </div>
            ) : (
              <span className='text-dark-neutral-400'>Select token</span>
            )}
            <ChevronDown
              className={cn(
                'h-4 w-4 text-dark-neutral-400 transition-transform',
                showTokenDropdown && 'rotate-180',
              )}
            />
          </button>

          {/* Token Dropdown */}
          {showTokenDropdown && (
            <div className='absolute top-full left-0 right-0 mt-2 bg-white border border-dark-neutral-50 rounded-sm shadow-xl z-10 max-h-48 overflow-y-auto'>
              {availableTokens.map((token, index) => {
                const isSelected =
                  selectedToken?.symbol === token.symbol &&
                  selectedToken?.chain === token.chain;
                return (
                  <button
                    key={`${token.chain}-${token.address}-${index}`}
                    onClick={() => {
                      setSelectedToken(token);
                      setShowTokenDropdown(false);
                      setAmount('');
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 p-4 transition-all text-left cursor-pointer',
                      isSelected
                        ? 'bg-brand-100/20 border-l-2 border-brand-950'
                        : 'hover:bg-pastels-polar-100/30',
                    )}
                  >
                    <CryptoIcon
                      chain={token.chain}
                      token={token.symbol}
                      className='w-10 h-10 shrink-0'
                    />
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center justify-between gap-3'>
                        <div>
                          <div className='font-semibold text-tundora-300 text-base'>
                            {token.symbol}
                          </div>
                          <div className='text-sm text-tundora-50 font-medium'>
                            {token.name}
                          </div>
                        </div>
                        <span className='text-xs font-medium text-dark-neutral-400 bg-pastels-polar-200 px-2.5 py-1.5 rounded-sm border border-dark-neutral-50 shrink-0'>
                          {token.chainName}
                        </span>
                      </div>
                      <div className='text-xs text-dark-neutral-400 mt-1'>
                        Balance: {formatBalance(token.balance)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Amount Input */}
      <div className='space-y-3'>
        <Label className='text-sm font-medium text-tundora-300'>Amount</Label>
        <div className='relative'>
          <Input
            type='number'
            placeholder='0.00'
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className={cn(
              'pr-20 h-12 text-lg font-medium',
              errors.amount &&
                'border-red-500 focus:border-red-500 focus-visible:ring-red-200',
            )}
          />
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={handleMaxClick}
            className='absolute right-3 top-1/2 -translate-y-1/2 h-7 px-3 text-xs font-semibold text-dark-neutral-400 hover:text-tundora-300 hover:bg-brand-100/20 rounded border border-dark-neutral-50 cursor-pointer'
          >
            MAX
          </Button>
        </div>
        {errors.amount && (
          <div className='flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-sm'>
            <div className='w-2 h-2 bg-red-500 rounded-full shrink-0'></div>
            <p className='text-xs text-red-800 font-medium'>{errors.amount}</p>
          </div>
        )}
        {selectedToken && !errors.amount && amount && (
          <div className='flex items-center gap-2 p-3 bg-pastels-polar-100 border border-dark-neutral-50 rounded-sm'>
            <div className='w-2 h-2 bg-success-500 rounded-full shrink-0'></div>
            <p className='text-xs text-dark-neutral-400 font-medium'>
              Available: {formatBalance(selectedToken.balance)}{' '}
              <span className='font-semibold text-tundora-300'>
                {selectedToken.symbol}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Receiver Address */}
      <div className='space-y-3'>
        <Label className='text-sm font-medium text-tundora-300'>
          Receiver Address
        </Label>
        <Input
          placeholder='0x1234567890abcdef1234567890abcdef12345678'
          value={receiverAddress}
          onChange={e => setReceiverAddress(e.target.value)}
          className={cn(
            'font-mono text-sm h-12',
            errors.receiverAddress &&
              'border-red-500 focus:border-red-500 focus-visible:ring-red-200',
          )}
        />
        {errors.receiverAddress && (
          <div className='flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-sm'>
            <div className='w-2 h-2 bg-red-500 rounded-full shrink-0'></div>
            <p className='text-xs text-red-800 font-medium'>
              {errors.receiverAddress}
            </p>
          </div>
        )}
        {!errors.receiverAddress && receiverAddress && (
          <div className='flex items-center gap-2 p-3 bg-pastels-polar-100 border border-dark-neutral-50 rounded-sm'>
            <div className='w-2 h-2 bg-success-500 rounded-full shrink-0'></div>
            <p className='text-xs text-dark-neutral-400 font-medium'>
              Valid Ethereum address
            </p>
          </div>
        )}
      </div>

      {/* Continue Button */}
      <Button
        onClick={handleSubmit}
        disabled={!selectedToken || !amount || !receiverAddress}
        className={cn(
          'w-full h-12 text-base font-semibold',
          (!selectedToken || !amount || !receiverAddress) 
            ? 'cursor-not-allowed' 
            : 'cursor-pointer'
        )}
        size='lg'
      >
        Continue
      </Button>
    </div>
  );
}
