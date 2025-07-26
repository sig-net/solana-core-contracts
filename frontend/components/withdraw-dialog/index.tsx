'use client';

import { useState } from 'react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useWithdrawMutation } from '@/hooks';

import { AmountInput } from './amount-input';
import { LoadingState } from './loading-state';
import { WithdrawSteps } from './withdraw-steps';

// Define WithdrawStatus type locally
export type WithdrawStatus =
  | 'processing'
  | 'waiting_signature'
  | 'submitting_ethereum'
  | 'confirming_ethereum'
  | 'waiting_read_response'
  | 'completing_withdrawal'
  | 'completed'
  | 'failed'
  | 'complete_failed'
  | 'processing_interrupted';

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

type WithdrawStep = 'amount-input' | 'steps';

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
    setStep('steps');

    // Start withdrawal immediately
    try {
      setError('');
      setWithdrawStatus('processing');

      withdrawMutation.mutate({
        erc20Address: data.token.address,
        amount: data.amount,
        recipientAddress: data.receiverAddress,
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
      setError('');
      setWithdrawStatus('processing');

      withdrawMutation.mutate({
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='flex max-h-[90vh] max-w-md flex-col overflow-hidden'>
        <DialogTitle>Send</DialogTitle>
        <div className='min-h-0 flex-1 overflow-y-auto'>
          {step === 'amount-input' && !isProcessing && (
            <AmountInput
              availableTokens={availableTokens}
              onSubmit={handleAmountSubmit}
              preSelectedToken={preSelectedToken}
            />
          )}

          {isProcessing && <LoadingState message='Calculating fees...' />}

          {step === 'steps' && transaction && (
            <WithdrawSteps
              token={transaction.token}
              amount={transaction.amount}
              recipientAddress={transaction.receiverAddress}
              status={withdrawStatus}
              txHash={txHash}
              error={error}
              onRetry={handleRetryWithdrawal}
              onClose={handleClose}
              onBack={() => setStep('amount-input')}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
