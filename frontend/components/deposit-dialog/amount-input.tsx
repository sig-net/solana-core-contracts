'use client';

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CryptoIcon } from '@/components/balance-display/crypto-icon';
import { DepositToken } from '@/lib/constants/deposit-tokens';

interface AmountInputProps {
  token: DepositToken;
  depositAddress: string;
  onBack: () => void;
  onProceed: (amount: string) => void;
}

export function AmountInput({ 
  token, 
  depositAddress, 
  onBack, 
  onProceed 
}: AmountInputProps) {
  const [amount, setAmount] = useState('');
  const [isValid, setIsValid] = useState(false);

  const handleAmountChange = (value: string) => {
    setAmount(value);
    // Basic validation - check if it's a valid number and > 0
    const numValue = parseFloat(value);
    setIsValid(!isNaN(numValue) && numValue > 0);
  };

  const handleProceed = () => {
    if (isValid) {
      onProceed(amount);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          onClick={onBack}
          variant="ghost"
          size="sm"
          className="p-1.5 h-auto"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-xl font-semibold text-dark-neutral-900">
          Deposit {token.symbol}
        </h2>
      </div>

      {/* Token Info */}
      <div className="flex items-center gap-3 p-4 bg-pastels-polar-100/30 rounded-lg border border-dark-neutral-50">
        <CryptoIcon
          chain={token.chain}
          token={token.symbol}
          className="w-10 h-10"
        />
        <div>
          <p className="font-semibold text-dark-neutral-900">{token.symbol}</p>
          <p className="text-sm text-dark-neutral-600">{token.name}</p>
        </div>
        <div className="ml-auto">
          <span className="text-xs font-medium text-dark-neutral-400 bg-pastels-polar-200 px-2.5 py-1.5 rounded-sm border border-dark-neutral-50">
            {token.chainName}
          </span>
        </div>
      </div>

      {/* Amount Input */}
      <div className="space-y-2">
        <Label htmlFor="amount" className="text-sm font-medium text-dark-neutral-900">
          Amount to deposit
        </Label>
        <div className="relative">
          <Input
            id="amount"
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            className="text-right pr-16"
            step="any"
            min="0"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <span className="text-sm font-medium text-dark-neutral-600">
              {token.symbol}
            </span>
          </div>
        </div>
        <p className="text-xs text-dark-neutral-500">
          Enter the amount you want to bridge to Solana
        </p>
      </div>

      {/* Deposit Address Info */}
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="text-sm font-medium text-blue-900 mb-2">
          Your Deposit Address
        </h4>
        <div className="bg-white p-3 rounded border break-all font-mono text-sm text-blue-800">
          {depositAddress}
        </div>
        <p className="text-xs text-blue-700 mt-2">
          You'll need to send {token.symbol} to this address first, then continue with the deposit process.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <Button
          onClick={onBack}
          variant="outline"
          className="flex-1"
        >
          Back
        </Button>
        <Button
          onClick={handleProceed}
          disabled={!isValid}
          className="flex-1"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}