'use client';

import { useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { AmountInput } from './amount-input';
import { TransactionConfirmation } from './transaction-confirmation';
import { SignatureRequest } from './signature-request';
import { LoadingState } from './loading-state';

export interface WithdrawToken {
  symbol: string;
  name: string;
  chain: 'ethereum' | 'solana';
  chainName: string;
  address: string;
  balance: string;
  decimals: number;
}

export interface WithdrawTransaction {
  token: WithdrawToken;
  amount: string;
  receiverAddress: string;
  estimatedFee: string;
  totalAmount: string;
}

interface WithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableTokens: WithdrawToken[];
  preSelectedToken?: WithdrawToken | null;
}

type WithdrawStep =
  | 'amount-input'
  | 'confirmation'
  | 'signature-request'
  | 'success';

export function WithdrawDialog({
  open,
  onOpenChange,
  availableTokens,
  preSelectedToken,
}: WithdrawDialogProps) {
  const [step, setStep] = useState<WithdrawStep>('amount-input');
  const [transaction, setTransaction] = useState<WithdrawTransaction | null>(
    null,
  );
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAmountSubmit = async (data: {
    token: WithdrawToken;
    amount: string;
    receiverAddress: string;
  }) => {
    setIsProcessing(true);

    // Simulate fee calculation
    await new Promise(resolve => setTimeout(resolve, 800));

    const estimatedFee = '0.001'; // Mock fee
    const totalAmount = (
      parseFloat(data.amount) + parseFloat(estimatedFee)
    ).toString();

    setTransaction({
      token: data.token,
      amount: data.amount,
      receiverAddress: data.receiverAddress,
      estimatedFee,
      totalAmount,
    });

    setIsProcessing(false);
    setStep('confirmation');
  };

  const handleConfirmTransaction = () => {
    setStep('signature-request');
  };

  const handleSignatureComplete = () => {
    setStep('success');
    // Auto close after success
    setTimeout(() => {
      handleClose();
    }, 2000);
  };

  const handleBack = () => {
    if (step === 'confirmation') {
      setStep('amount-input');
    } else if (step === 'signature-request') {
      setStep('confirmation');
    }
  };

  const handleClose = () => {
    setStep('amount-input');
    setTransaction(null);
    setIsProcessing(false);
    onOpenChange(false);
  };

  const getDialogTitle = () => {
    switch (step) {
      case 'amount-input':
        return 'Send';
      case 'confirmation':
        return 'Confirm Transaction';
      case 'signature-request':
        return 'Sign Transaction';
      case 'success':
        return 'Transaction Sent';
      default:
        return 'Send';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='max-w-lg'>
        <DialogHeader className='pb-2'>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
        </DialogHeader>

        {step === 'amount-input' && !isProcessing && (
          <AmountInput
            availableTokens={availableTokens}
            onSubmit={handleAmountSubmit}
            preSelectedToken={preSelectedToken}
          />
        )}

        {isProcessing && <LoadingState message='Calculating fees...' />}

        {step === 'confirmation' && transaction && (
          <TransactionConfirmation
            transaction={transaction}
            onConfirm={handleConfirmTransaction}
            onBack={handleBack}
          />
        )}

        {step === 'signature-request' && transaction && (
          <SignatureRequest
            transaction={transaction}
            onSignatureComplete={handleSignatureComplete}
            onBack={handleBack}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
