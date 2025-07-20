'use client';

import { useState } from 'react';
import { ArrowLeft, Loader2, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CryptoIcon } from '@/components/balance-display/crypto-icon';

import { WithdrawTransaction } from './index';

interface SignatureRequestProps {
  transaction: WithdrawTransaction;
  onSignatureComplete: () => void;
  onBack: () => void;
}

type SignatureStatus = 'pending' | 'signing' | 'success' | 'error';

export function SignatureRequest({
  transaction,
  onSignatureComplete,
  onBack,
}: SignatureRequestProps) {
  const [status, setStatus] = useState<SignatureStatus>('pending');
  const [error, setError] = useState<string | null>(null);

  const formatAmount = (amount: string) => {
    const num = parseFloat(amount);
    if (num === 0) return '0';
    if (num < 0.01) return '< 0.01';
    return num.toFixed(6).replace(/\.?0+$/, '');
  };

  const handleSign = async () => {
    setStatus('signing');
    setError(null);

    try {
      // Mock signature process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Simulate random success/failure for demo
      const shouldSucceed = Math.random() > 0.3; // 70% success rate

      if (shouldSucceed) {
        setStatus('success');
        setTimeout(() => {
          onSignatureComplete();
        }, 1500);
      } else {
        throw new Error('User rejected the transaction');
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Signature failed');
    }
  };

  const getStatusContent = () => {
    switch (status) {
      case 'pending':
        return {
          title: 'Sign Transaction',
          description:
            'Please sign the transaction in your wallet to complete the transfer.',
          action: (
            <div className='flex gap-4'>
              <Button
                variant='outline'
                onClick={onBack}
                className='flex-1 h-12 text-base font-semibold'
                size='lg'
              >
                Cancel
              </Button>
              <Button
                onClick={handleSign}
                className='flex-1 h-12 text-base font-semibold'
                size='lg'
              >
                Sign Transaction
              </Button>
            </div>
          ),
        };

      case 'signing':
        return {
          title: 'Signing Transaction',
          description: 'Please check your wallet and approve the transaction.',
          action: (
            <div className='flex justify-center'>
              <div className='flex items-center gap-3 text-dark-neutral-400'>
                <Loader2 className='h-6 w-6 animate-spin' />
                <span className='font-semibold text-base'>
                  Waiting for signature...
                </span>
              </div>
            </div>
          ),
        };

      case 'success':
        return {
          title: 'Transaction Signed',
          description:
            'Your transaction has been signed and broadcasted to the network.',
          action: (
            <div className='flex justify-center'>
              <div className='flex items-center gap-3 text-success-500'>
                <Check className='h-6 w-6' />
                <span className='font-semibold text-base'>
                  Transaction sent successfully!
                </span>
              </div>
            </div>
          ),
        };

      case 'error':
        return {
          title: 'Signature Failed',
          description: error || 'The transaction could not be signed.',
          action: (
            <div className='flex gap-4'>
              <Button
                variant='outline'
                onClick={onBack}
                className='flex-1 h-12 text-base font-semibold'
                size='lg'
              >
                Back
              </Button>
              <Button
                onClick={handleSign}
                className='flex-1 h-12 text-base font-semibold'
                size='lg'
              >
                Try Again
              </Button>
            </div>
          ),
        };
    }
  };

  const statusContent = getStatusContent();

  return (
    <div className='space-y-6'>
      {/* Header */}
      {status === 'pending' && (
        <div className='flex items-center gap-3 pb-2'>
          <Button
            variant='ghost'
            size='icon'
            onClick={onBack}
            className='hover:bg-pastels-polar-100'
          >
            <ArrowLeft className='h-5 w-5' />
          </Button>
          <h3 className='text-xl font-semibold text-tundora-300'>
            {statusContent.title}
          </h3>
        </div>
      )}

      {status !== 'pending' && (
        <div className='text-center pb-2'>
          <h3 className='text-xl font-semibold text-tundora-300 mb-2'>
            {statusContent.title}
          </h3>
        </div>
      )}

      {/* Transaction Summary */}
      <div className='bg-pastels-polar-200 border border-dark-neutral-50 rounded-sm p-8 text-center space-y-5'>
        <div className='flex justify-center'>
          <div className='relative'>
            <CryptoIcon
              chain={transaction.token.chain}
              token={transaction.token.symbol}
              className='w-16 h-16'
            />
            {status === 'signing' && (
              <div className='absolute -top-1 -right-1 w-6 h-6 bg-brand-950 border-2 border-white rounded-full flex items-center justify-center'>
                <Loader2 className='h-3 w-3 text-white animate-spin' />
              </div>
            )}
            {status === 'success' && (
              <div className='absolute -top-1 -right-1 w-6 h-6 bg-success-500 border-2 border-white rounded-full flex items-center justify-center'>
                <Check className='h-3 w-3 text-white' />
              </div>
            )}
          </div>
        </div>

        <div>
          <div className='text-3xl font-semibold text-tundora-300 mb-2'>
            {formatAmount(transaction.amount)} {transaction.token.symbol}
          </div>
          <div className='text-sm text-dark-neutral-400 font-medium'>
            + {formatAmount(transaction.estimatedFee)}{' '}
            {transaction.token.symbol} network fee
          </div>
        </div>

        <div className='space-y-2'>
          <div className='text-sm text-dark-neutral-400 font-medium'>
            <div>
              To: {transaction.receiverAddress.slice(0, 10)}...
              {transaction.receiverAddress.slice(-10)}
            </div>
          </div>
          <div className='inline-flex items-center gap-2 bg-white border border-dark-neutral-50 rounded-sm px-3 py-1.5'>
            <div className='w-2 h-2 bg-success-500 rounded-full'></div>
            <span className='text-xs font-medium text-dark-neutral-400'>
              {transaction.token.chainName}
            </span>
          </div>
        </div>
      </div>

      {/* Status Description */}
      <div className='text-center'>
        <p className='text-base text-dark-neutral-400 leading-relaxed font-medium'>
          {statusContent.description}
        </p>
      </div>

      {/* Wallet Instructions (only for pending/signing) */}
      {(status === 'pending' || status === 'signing') && (
        <div className='bg-pastels-polar-100 border border-dark-neutral-50 rounded-sm p-5'>
          <div className='flex items-start gap-3'>
            <div className='w-2 h-2 bg-brand-950 rounded-full mt-2 shrink-0'></div>
            <div className='text-sm text-tundora-300'>
              <p className='font-semibold mb-2'>Wallet Required</p>
              <p className='text-dark-neutral-400 font-medium leading-relaxed'>
                {transaction.token.chain === 'ethereum'
                  ? 'MetaMask or another Ethereum wallet will prompt you to sign this transaction.'
                  : 'Phantom or another Solana wallet will prompt you to sign this transaction.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {status === 'error' && error && (
        <div className='bg-red-50 border border-red-200 rounded-sm p-5'>
          <div className='flex items-start gap-3'>
            <div className='w-2 h-2 bg-red-500 rounded-full mt-2 shrink-0'></div>
            <div className='text-sm text-red-800'>
              <p className='font-semibold mb-2'>Error</p>
              <p className='font-medium leading-relaxed'>{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {statusContent.action}
    </div>
  );
}
