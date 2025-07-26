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

enum DepositStep {
  SELECT_TOKEN = 'select-token',
  GENERATING_ADDRESS = 'generating-address',
  SHOW_ADDRESS = 'show-address',
  AMOUNT_INPUT = 'amount-input',
  PROCESSING = 'processing',
}

export function DepositDialog({ open, onOpenChange }: DepositDialogProps) {
  const { publicKey } = useWallet();
  const [step, setStep] = useState<DepositStep>(DepositStep.SELECT_TOKEN);
  const [selectedToken, setSelectedToken] = useState<DepositToken | null>(null);
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [depositStatus, setDepositStatus] =
    useState<DepositStatus>('processing');
  const [txHash, setTxHash] = useState<string>('');
  const [error, setError] = useState<string>('');

  const { data: depositAddress, isLoading: isGeneratingAddress } =
    useDepositAddress();

  const depositMutation = useDepositErc20Mutation();

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

  const handleContinueToAmount = () => {
    setStep(DepositStep.AMOUNT_INPUT);
  };

  const handleAmountSet = (amount: string) => {
    setDepositAmount(amount);
    setStep(DepositStep.PROCESSING);
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
    if (
      step === DepositStep.SHOW_ADDRESS ||
      step === DepositStep.GENERATING_ADDRESS
    ) {
      setStep(DepositStep.SELECT_TOKEN);
      setSelectedToken(null);
    } else if (step === DepositStep.AMOUNT_INPUT) {
      setStep(DepositStep.SHOW_ADDRESS);
    }
  };

  const handleClose = () => {
    setStep(DepositStep.SELECT_TOKEN);
    setSelectedToken(null);
    setDepositAmount('');
    setDepositStatus('processing');
    setTxHash('');
    setError('');
    onOpenChange(false);
  };

  if (
    step === DepositStep.GENERATING_ADDRESS &&
    depositAddress &&
    !isGeneratingAddress
  ) {
    setStep(DepositStep.SHOW_ADDRESS);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='gradient-popover max-w-xl p-10'>
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
                onBack={handleBack}
                depositAddress={depositAddress}
                onContinue={handleContinueToAmount}
              />
            </>
          )}

        {step === DepositStep.AMOUNT_INPUT &&
          selectedToken &&
          depositAddress && (
            <AmountInput
              token={selectedToken}
              depositAddress={depositAddress}
              onBack={handleBack}
              onProceed={handleAmountSet}
            />
          )}

        {step === DepositStep.PROCESSING && selectedToken && (
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
