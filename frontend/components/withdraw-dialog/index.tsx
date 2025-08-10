'use client';

import { useState } from 'react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { LoadingState } from '@/components/states';
import { useWithdrawEvmMutation, useWithdrawSolMutation } from '@/hooks';

import { AmountInput } from './amount-input';

export interface WithdrawToken {
  symbol: string;
  name: string;
  chain: 'ethereum' | 'solana';
  chainName: string;
  address: string;
  balance: string;
  decimals: number;
}

interface WithdrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableTokens: WithdrawToken[];
  preSelectedToken?: WithdrawToken | null;
}

export function WithdrawDialog({
  open,
  onOpenChange,
  availableTokens,
  preSelectedToken,
}: WithdrawDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  // Withdrawal mutations
  const withdrawEvmMutation = useWithdrawEvmMutation();
  const withdrawSolMutation = useWithdrawSolMutation();

  const handleAmountSubmit = async (data: {
    token: WithdrawToken;
    amount: string;
    receiverAddress: string;
  }) => {
    setIsProcessing(true);

    try {
      if (data.token.chain === 'solana') {
        await withdrawSolMutation.mutateAsync({
          mintAddress: data.token.address,
          amount: data.amount,
          recipientAddress: data.receiverAddress,
          decimals: data.token.decimals,
        });
      } else {
        await withdrawEvmMutation.mutateAsync({
          erc20Address: data.token.address,
          amount: data.amount,
          recipientAddress: data.receiverAddress,
        });
      }

      // Close dialog immediately after successful submission
      handleClose();
    } catch (err) {
      console.error('Withdrawal failed:', err);
      // Still close dialog - user can check activity table later
      handleClose();
    }
  };

  const handleClose = () => {
    // Reset all state
    setIsProcessing(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='flex max-h-[90vh] max-w-md flex-col overflow-hidden p-6 sm:p-8'>
        <DialogTitle>Send</DialogTitle>
        <div className='min-h-0 flex-1 overflow-y-auto'>
          {!isProcessing && (
            <AmountInput
              availableTokens={availableTokens}
              onSubmit={handleAmountSubmit}
              preSelectedToken={preSelectedToken}
            />
          )}

          {isProcessing && <LoadingState message='Processing withdrawal...' />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
