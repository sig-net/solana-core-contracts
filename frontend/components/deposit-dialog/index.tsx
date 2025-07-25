'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DepositToken } from '@/lib/constants/deposit-tokens';
import { useDepositAddress, useDepositErc20Mutation } from '@/hooks';

import { TokenSelection } from './token-selection';
import { DepositAddress } from './deposit-address';
import { LoadingState } from './loading-state';
import { AmountInput } from './amount-input';
import { DepositProcessing, DepositStatus } from './deposit-processing';

interface DepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DepositStep =
  | 'select-token'
  | 'generating-address'
  | 'show-address'
  | 'amount-input'
  | 'processing';

export function DepositDialog({ open, onOpenChange }: DepositDialogProps) {
  const { publicKey } = useWallet();
  const [step, setStep] = useState<DepositStep>('select-token');
  const [selectedToken, setSelectedToken] = useState<DepositToken | null>(null);
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [depositStatus, setDepositStatus] =
    useState<DepositStatus>('processing');
  const [txHash, setTxHash] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Get deposit address for selected token
  const { data: depositAddress, isLoading: isGeneratingAddress } =
    useDepositAddress();

  // Deposit mutation
  const depositMutation = useDepositErc20Mutation();

  const handleTokenSelect = (token: DepositToken) => {
    if (token.chain !== 'ethereum') {
      // For now, only support Ethereum tokens for bridging
      return;
    }

    setSelectedToken(token);
    setStep('generating-address');

    // Wait for address to be generated
    if (depositAddress) {
      setStep('show-address');
    }
  };

  const handleContinueToAmount = () => {
    setStep('amount-input');
  };

  const handleAmountSet = (amount: string) => {
    setDepositAmount(amount);
    setStep('processing');
    initiateDeposit(amount);
  };

  const initiateDeposit = async (amount: string) => {
    if (!selectedToken || !publicKey) return;

    try {
      setError('');
      setDepositStatus('processing');

      await depositMutation.mutateAsync({
        erc20Address: selectedToken.address,
        amount,
        decimals: selectedToken.decimals,
        onStatusChange: status => {
          setDepositStatus(status.status as DepositStatus);
          if (status.txHash) {
            setTxHash(status.txHash);
          }
          if (status.error) {
            setError(status.error);
          }
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deposit failed');
      setDepositStatus('failed');
    }
  };

  const handleRetryDeposit = () => {
    if (depositAmount) {
      initiateDeposit(depositAmount);
    }
  };

  const handleBack = () => {
    if (step === 'show-address' || step === 'generating-address') {
      setStep('select-token');
      setSelectedToken(null);
    } else if (step === 'amount-input') {
      setStep('show-address');
    }
  };

  const handleClose = () => {
    // Reset all state
    setStep('select-token');
    setSelectedToken(null);
    setDepositAmount('');
    setDepositStatus('processing');
    setTxHash('');
    setError('');
    onOpenChange(false);
  };

  // When address is loaded, move to show-address step
  if (step === 'generating-address' && depositAddress && !isGeneratingAddress) {
    setStep('show-address');
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='max-w-xl'>
        {step === 'select-token' && (
          <>
            <DialogHeader className='pb-2'>
              <DialogTitle>Deposit Tokens</DialogTitle>
            </DialogHeader>
            <TokenSelection
              onTokenSelect={handleTokenSelect}
              selectedToken={selectedToken || undefined}
            />
          </>
        )}

        {step === 'generating-address' && selectedToken && (
          <LoadingState token={selectedToken} />
        )}

        {step === 'show-address' && selectedToken && depositAddress && (
          <DepositAddress
            token={selectedToken}
            onBack={handleBack}
            depositAddress={depositAddress}
            onContinue={handleContinueToAmount}
          />
        )}

        {step === 'amount-input' && selectedToken && depositAddress && (
          <AmountInput
            token={selectedToken}
            depositAddress={depositAddress}
            onBack={handleBack}
            onProceed={handleAmountSet}
          />
        )}

        {step === 'processing' && selectedToken && (
          <DepositProcessing
            token={selectedToken}
            amount={depositAmount}
            status={depositStatus}
            txHash={txHash}
            error={error}
            onRetry={handleRetryDeposit}
            onClose={handleClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
