'use client';

import { useState } from 'react';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useWithdrawMutation } from '@/hooks';

import { AmountInput } from './amount-input';
import { TransactionConfirmation } from './transaction-confirmation';
import { LoadingState } from './loading-state';
import { WithdrawProcessing, WithdrawStatus } from './withdraw-processing';

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

type WithdrawStep = 'amount-input' | 'confirmation' | 'processing';

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
  const [withdrawStatus, setWithdrawStatus] =
    useState<WithdrawStatus>('processing');
  const [txHash, setTxHash] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Withdrawal mutation
  const withdrawMutation = useWithdrawMutation();

  const handleAmountSubmit = async (data: {
    token: WithdrawToken;
    amount: string;
    receiverAddress: string;
  }) => {
    setIsProcessing(true);

    // Simulate fee calculation (you can enhance this later)
    await new Promise(resolve => setTimeout(resolve, 800));

    const estimatedFee = '0.001'; // Mock fee - enhance this later
    const totalAmount = data.amount; // For now, don't add fees

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
    setStep('processing');
    initiateWithdrawal();
  };

  const initiateWithdrawal = async () => {
    if (!transaction) return;

    try {
      setError('');
      setWithdrawStatus('processing');

      await withdrawMutation.mutateAsync({
        erc20Address: transaction.token.address,
        amount: transaction.amount,
        recipientAddress: transaction.receiverAddress,
        onStatusChange: status => {
          setWithdrawStatus(status.status as WithdrawStatus);
          if (status.txHash) {
            setTxHash(status.txHash);
          }
          if (status.error) {
            setError(status.error);
          }
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Withdrawal failed');
      setWithdrawStatus('failed');
    }
  };

  const handleRetryWithdrawal = () => {
    if (transaction) {
      initiateWithdrawal();
    }
  };

  const handleBack = () => {
    if (step === 'confirmation') {
      setStep('amount-input');
    }
  };

  const handleClose = () => {
    // Reset all state
    setStep('amount-input');
    setTransaction(null);
    setIsProcessing(false);
    setWithdrawStatus('processing');
    setTxHash('');
    setError('');
    onOpenChange(false);
  };

  const getDialogTitle = () => {
    switch (step) {
      case 'amount-input':
        return 'Withdraw Tokens';
      case 'confirmation':
        return 'Confirm Withdrawal';
      case 'processing':
        return 'Processing Withdrawal';
      default:
        return 'Withdraw';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='flex max-h-[90vh] max-w-md flex-col overflow-hidden'>
        <div className='min-h-0 flex-1 overflow-y-auto'>
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

          {step === 'processing' && transaction && (
            <WithdrawProcessing
              token={transaction.token}
              amount={transaction.amount}
              recipientAddress={transaction.receiverAddress}
              status={withdrawStatus}
              txHash={txHash}
              error={error}
              onRetry={handleRetryWithdrawal}
              onClose={handleClose}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
