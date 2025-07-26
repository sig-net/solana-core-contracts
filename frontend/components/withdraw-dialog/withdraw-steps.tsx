'use client';

import { ArrowLeft, ExternalLink, Send, Zap, CheckCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Steps, Step } from '@/components/ui/steps';
import { CryptoIcon } from '@/components/balance-display/crypto-icon';
import { WithdrawToken, WithdrawStatus } from './index';

interface WithdrawStepsProps {
  token: WithdrawToken;
  amount: string;
  recipientAddress: string;
  status: WithdrawStatus;
  txHash?: string;
  error?: string;
  onBack: () => void;
  onClose: () => void;
  onRetry?: () => void;
}

export function WithdrawSteps({
  token,
  amount,
  recipientAddress,
  status,
  txHash,
  error,
  onBack,
  onClose,
  onRetry,
}: WithdrawStepsProps) {
  const getSteps = (): Step[] => {
    const baseSteps: Step[] = [
      {
        id: 'initiate',
        title: 'Withdrawal initiated',
        description: `${amount} ${token.symbol} to ${token.chainName}`,
        status: [
          'processing',
          'waiting_signature',
          'submitting_ethereum',
          'confirming_ethereum',
          'waiting_read_response',
          'completing_withdrawal',
          'completed',
        ].includes(status)
          ? 'completed'
          : ['failed', 'complete_failed', 'processing_interrupted'].includes(
                status,
              )
            ? 'failed'
            : 'pending',
        icon: Send,
      },
      {
        id: 'bridge',
        title: 'Processing withdrawal',
        description: 'MPC signature & Ethereum submission',
        status: ['completing_withdrawal', 'completed'].includes(status)
          ? 'completed'
          : [
                'processing',
                'waiting_signature',
                'submitting_ethereum',
                'confirming_ethereum',
                'waiting_read_response',
              ].includes(status)
            ? 'loading'
            : ['failed', 'complete_failed', 'processing_interrupted'].includes(
                  status,
                )
              ? 'failed'
              : 'pending',
        icon: Zap,
        details: txHash && (
          <a
            href={`https://sepolia.etherscan.io/tx/${txHash}`}
            target='_blank'
            rel='noopener noreferrer'
            className='flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800'
          >
            View on Etherscan
            <ExternalLink className='h-3 w-3' />
          </a>
        ),
      },
      {
        id: 'complete',
        title: 'Tokens sent',
        description: `Available in ${recipientAddress.slice(0, 6)}...${recipientAddress.slice(-4)}`,
        status:
          status === 'completed'
            ? 'completed'
            : status === 'completing_withdrawal'
              ? 'loading'
              : 'pending',
        icon: CheckCircle,
      },
    ];

    return baseSteps;
  };

  const steps = getSteps();

  const isComplete = status === 'completed';
  const hasFailed = [
    'failed',
    'complete_failed',
    'processing_interrupted',
  ].includes(status);
  const isProcessing = [
    'processing',
    'waiting_signature',
    'submitting_ethereum',
    'confirming_ethereum',
    'waiting_read_response',
    'completing_withdrawal',
  ].includes(status);

  return (
    <div className='space-y-4'>
      {/* Compact Header */}
      <div className='text-center'>
        <h2 className='text-dark-neutral-900 mb-1 text-lg font-semibold'>
          Withdrawal Progress
        </h2>
        <p className='text-dark-neutral-600 text-sm'>
          Track your withdrawal progress
        </p>
      </div>

      {/* Compact Token Info */}
      <div className='bg-pastels-polar-100/30 border-dark-neutral-50 flex items-center gap-2 rounded-md border p-3'>
        <CryptoIcon
          chain={token.chain}
          token={token.symbol}
          className='h-6 w-6'
        />
        <div className='min-w-0 flex-1'>
          <p className='text-dark-neutral-900 truncate text-sm font-medium'>
            {amount} {token.symbol}
          </p>
          <p className='text-dark-neutral-600 truncate text-xs'>
            To {recipientAddress.slice(0, 8)}...{recipientAddress.slice(-6)}
          </p>
        </div>
      </div>

      {/* Compact Steps */}
      <Steps steps={steps} compact={true} className='px-2' />

      {/* Compact Error Display */}
      {error && (
        <div className='rounded-md border border-red-200 bg-red-50 p-3'>
          <p className='text-xs font-medium text-red-900'>Error:</p>
          <p className='text-xs text-red-700'>{error}</p>
        </div>
      )}

      {/* Compact Action Buttons */}
      <div className='flex gap-2 pt-2'>
        {!isComplete && !hasFailed && !isProcessing && (
          <Button
            onClick={onBack}
            variant='outline'
            size='sm'
            className='flex-1'
          >
            <ArrowLeft className='mr-1 h-3 w-3' />
            Back
          </Button>
        )}

        {isComplete && (
          <Button onClick={onClose} size='sm' className='flex-1'>
            Done
          </Button>
        )}

        {hasFailed && (
          <>
            <Button
              onClick={onClose}
              variant='outline'
              size='sm'
              className='flex-1'
            >
              Close
            </Button>
            {onRetry && (
              <Button onClick={onRetry} size='sm' className='flex-1'>
                Retry
              </Button>
            )}
          </>
        )}

        {isProcessing && (
          <Button disabled variant='outline' size='sm' className='flex-1'>
            Processing...
          </Button>
        )}
      </div>
    </div>
  );
}
