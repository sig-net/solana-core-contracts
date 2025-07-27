'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DepositToken } from '@/lib/constants/deposit-tokens';
import { useDepositAddress } from '@/hooks';

import { TokenSelection } from './token-selection';
import { DepositAddress } from './deposit-address';
import { LoadingState } from './loading-state';
import { DepositSteps } from './deposit-steps';

interface DepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

enum DepositStep {
  SELECT_TOKEN = 'select-token',
  GENERATING_ADDRESS = 'generating-address',
  SHOW_ADDRESS = 'show-address',
  STEPS = 'steps',
}

export function DepositDialog({ open, onOpenChange }: DepositDialogProps) {
  const { publicKey } = useWallet();
  const [step, setStep] = useState<DepositStep>(DepositStep.SELECT_TOKEN);
  const [selectedToken, setSelectedToken] = useState<DepositToken | null>(null);

  const { data: depositAddress, isLoading: isGeneratingAddress } =
    useDepositAddress();

  const handleTokenSelect = (token: DepositToken) => {
    if (token.chain !== 'ethereum') {
      return;
    }

    setSelectedToken(token);
    setStep(DepositStep.GENERATING_ADDRESS);

    if (depositAddress) {
      setStep(DepositStep.SHOW_ADDRESS);
    }
  };

  const handleContinueToSteps = () => {
    setStep(DepositStep.STEPS);
  };

  const handleBack = () => {
    if (
      step === DepositStep.SHOW_ADDRESS ||
      step === DepositStep.GENERATING_ADDRESS
    ) {
      setStep(DepositStep.SELECT_TOKEN);
      setSelectedToken(null);
    } else if (step === DepositStep.STEPS) {
      setStep(DepositStep.SHOW_ADDRESS);
    }
  };

  const handleClose = () => {
    setStep(DepositStep.SELECT_TOKEN);
    setSelectedToken(null);
    onOpenChange(false);
  };

  useEffect(() => {
    if (
      step === DepositStep.GENERATING_ADDRESS &&
      depositAddress &&
      !isGeneratingAddress
    ) {
      setStep(DepositStep.SHOW_ADDRESS);
    }
  }, [step, depositAddress, isGeneratingAddress]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='gradient-popover max-w-md p-6 sm:p-10'>
        {step === DepositStep.SELECT_TOKEN && (
          <>
            <DialogHeader>
              <DialogTitle>Deposit Tokens</DialogTitle>
            </DialogHeader>
            <TokenSelection onTokenSelect={handleTokenSelect} />
          </>
        )}

        {step === DepositStep.GENERATING_ADDRESS && selectedToken && (
          <LoadingState token={selectedToken} />
        )}

        {step === DepositStep.SHOW_ADDRESS &&
          selectedToken &&
          depositAddress && (
            <>
              <DialogHeader>
                <DialogTitle>Deposit Address</DialogTitle>
              </DialogHeader>
              <DepositAddress
                token={selectedToken}
                depositAddress={depositAddress}
                onContinue={handleContinueToSteps}
              />
            </>
          )}

        {step === DepositStep.STEPS && selectedToken && (
          <DepositSteps
            token={selectedToken}
            onBack={handleBack}
            onClose={handleClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
