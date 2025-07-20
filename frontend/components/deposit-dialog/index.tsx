'use client';

import { useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DepositToken } from '@/lib/constants/deposit-tokens';

import { TokenSelection } from './token-selection';
import { DepositAddress } from './deposit-address';
import { LoadingState } from './loading-state';

interface DepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DepositStep = 'select-token' | 'show-address';

export function DepositDialog({ open, onOpenChange }: DepositDialogProps) {
  const [step, setStep] = useState<DepositStep>('select-token');
  const [selectedToken, setSelectedToken] = useState<DepositToken | null>(null);
  const [isGeneratingAddress, setIsGeneratingAddress] = useState(false);

  // Mock deposit address - in real app this would be generated per user/token
  const generateDepositAddress = (token: DepositToken): string => {
    // This is a mock implementation
    if (token.chain === 'ethereum') {
      return '0x742d35cc6af58e9e3d8a8b6c4b8e5ff1ca7b2345';
    } else if (token.chain === 'solana') {
      return 'DRiP2Pn2K6fuMLKQmt5rZWxa91HWqnA5a5uoMQqk7uYy';
    }
    return 'address-not-available';
  };

  const handleTokenSelect = async (token: DepositToken) => {
    setSelectedToken(token);
    setIsGeneratingAddress(true);

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 800));

    setIsGeneratingAddress(false);
    setStep('show-address');
  };

  const handleBack = () => {
    setStep('select-token');
    setSelectedToken(null);
  };

  const handleClose = () => {
    setStep('select-token');
    setSelectedToken(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='max-w-xl'>
        <DialogHeader className='pb-2'>
          <DialogTitle>
            {step === 'select-token'
              ? 'Deposit'
              : isGeneratingAddress
                ? 'Generating Address'
                : 'Deposit Address'}
          </DialogTitle>
        </DialogHeader>

        {step === 'select-token' && !isGeneratingAddress && (
          <TokenSelection
            onTokenSelect={handleTokenSelect}
            selectedToken={selectedToken || undefined}
          />
        )}

        {isGeneratingAddress && selectedToken && (
          <LoadingState token={selectedToken} />
        )}

        {step === 'show-address' && selectedToken && !isGeneratingAddress && (
          <DepositAddress
            token={selectedToken}
            onBack={handleBack}
            depositAddress={generateDepositAddress(selectedToken)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
