'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TokenMetadata } from '@/lib/constants/token-metadata';
import { useDepositAddress } from '@/hooks';
import { useDepositErc20Mutation } from '@/hooks/use-deposit-erc20-mutation';

import { TokenSelection } from './token-selection';
import { DepositAddress } from './deposit-address';
import { LoadingState } from './loading-state';

interface DepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

enum DepositStep {
  SELECT_TOKEN = 'select-token',
  GENERATING_ADDRESS = 'generating-address',
  SHOW_ADDRESS = 'show-address',
}

export function DepositDialog({ open, onOpenChange }: DepositDialogProps) {
  const { publicKey } = useWallet();
  const [step, setStep] = useState<DepositStep>(DepositStep.SELECT_TOKEN);
  const [selectedToken, setSelectedToken] = useState<TokenMetadata | null>(
    null,
  );

  const { data: depositAddress, isLoading: isGeneratingAddress } =
    useDepositAddress();
  const depositMutation = useDepositErc20Mutation();

  const handleTokenSelect = (token: TokenMetadata) => {
    if (token.chain !== 'ethereum') {
      return;
    }

    setSelectedToken(token);
    setStep(DepositStep.GENERATING_ADDRESS);

    if (depositAddress) {
      setStep(DepositStep.SHOW_ADDRESS);
    }
  };

  const handleNotifyRelayer = async () => {
    if (!publicKey || !selectedToken) return;

    try {
      // Notify relayer and close dialog - processing happens in background
      await depositMutation.mutateAsync({
        erc20Address: selectedToken.address,
        amount: '', // Empty amount since user determines actual amount sent
        decimals: selectedToken.decimals,
      });

      // Close dialog immediately after notification
      handleClose();
    } catch (err) {
      console.error('Failed to notify relayer:', err);
      // Still close dialog - user can check activity table later
      handleClose();
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
                onContinue={handleNotifyRelayer}
              />
            </>
          )}
      </DialogContent>
    </Dialog>
  );
}
