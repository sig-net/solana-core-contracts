'use client';

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  Send,
  Zap,
  CheckCircle,
} from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';

import { Button } from '@/components/ui/button';
import { Steps, Step } from '@/components/ui/steps';
import { CryptoIcon } from '@/components/balance-display/crypto-icon';
import { DepositToken } from '@/lib/constants/deposit-tokens';
import { useIncomingTransfers } from '@/hooks/use-incoming-transfers';
import { useDepositErc20Mutation } from '@/hooks/use-deposit-erc20-mutation';
import { DepositStatus } from '@/lib/types/bridge.types';

interface DepositStepsProps {
  token: DepositToken;
  onBack: () => void;
  onClose: () => void;
}


export function DepositSteps({ token, onBack, onClose }: DepositStepsProps) {
  const { publicKey } = useWallet();
  const { data: incomingTransfers, isLoading: isCheckingTransfers } =
    useIncomingTransfers();
  const depositMutation = useDepositErc20Mutation();

  const [detectedTx, setDetectedTx] = useState<any>(null);
  const [depositStatus, setDepositStatus] =
    useState<DepositStatus>('processing');
  const [txHash, setTxHash] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [hasStartedBridge, setHasStartedBridge] = useState(false);

  // Check for incoming transactions
  useEffect(() => {
    if (incomingTransfers && incomingTransfers.length > 0 && !detectedTx) {
      // Find the most recent transaction for our supported token
      const relevantTx = incomingTransfers.find(
        tx => tx.tokenAddress.toLowerCase() === token.address.toLowerCase(),
      );

      if (relevantTx) {
        setDetectedTx(relevantTx);
      }
    }
  }, [incomingTransfers, token.address, detectedTx]);

  // Auto-start bridge process when transaction is detected and confirmed
  useEffect(() => {
    if (detectedTx && !hasStartedBridge && publicKey) {
      const startBridge = async () => {
        setHasStartedBridge(true);

        try {
          // Convert the detected amount back to human readable format
          const decimals = token.decimals;
          const amount = (
            Number(detectedTx.value) / Math.pow(10, decimals)
          ).toString();

          await depositMutation.mutateAsync({
            erc20Address: token.address,
            amount,
            decimals: token.decimals,
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
          setError(err instanceof Error ? err.message : 'Bridge failed');
          setDepositStatus('failed');
        }
      };

      // Start bridge process after a short delay to let user see transaction detected
      setTimeout(startBridge, 2000);
    }
  }, [detectedTx, hasStartedBridge, publicKey, depositMutation, token]);

  const getSteps = (): Step[] => {
    const baseSteps: Step[] = [
      {
        id: 'send',
        title: 'Send tokens to address',
        description: `Send ${token.symbol} to the provided address`,
        status: detectedTx
          ? 'completed'
          : isCheckingTransfers
            ? 'loading'
            : 'pending',
        icon: Send,
      },
      {
        id: 'detect',
        title: 'Transaction detected',
        description: 'Found on the blockchain',
        status: detectedTx ? 'completed' : 'pending',
        icon: CheckCircle,
        details: detectedTx && (
          <a
            href={`https://sepolia.etherscan.io/tx/${detectedTx.transactionHash}`}
            target='_blank'
            rel='noopener noreferrer'
            className='flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800'
          >
            View transaction
            <ExternalLink className='h-3 w-3' />
          </a>
        ),
      },
      {
        id: 'bridge',
        title: 'Bridging to Solana',
        description: 'Processing through bridge',
        status: hasStartedBridge
          ? ['completed'].includes(depositStatus)
            ? 'completed'
            : ['failed', 'claim_failed'].includes(depositStatus)
              ? 'failed'
              : 'loading'
          : 'pending',
        icon: Zap,
        details: txHash && (
          <a
            href={`https://sepolia.etherscan.io/tx/${txHash}`}
            target='_blank'
            rel='noopener noreferrer'
            className='flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800'
          >
            View bridge transaction
            <ExternalLink className='h-3 w-3' />
          </a>
        ),
      },
      {
        id: 'complete',
        title: 'Tokens received',
        description: 'Available in your Solana wallet',
        status: depositStatus === 'completed' ? 'completed' : 'pending',
        icon: CheckCircle,
      },
    ];

    return baseSteps;
  };

  const steps = getSteps();

  const isComplete = depositStatus === 'completed';
  const hasFailed = ['failed', 'claim_failed'].includes(depositStatus);

  return (
    <div className='space-y-4'>
      {/* Compact Header */}
      <div className='text-center'>
        <h2 className='text-dark-neutral-900 mb-1 text-lg font-semibold'>
          Deposit Progress
        </h2>
        <p className='text-dark-neutral-600 text-sm'>
          Track your deposit progress
        </p>
      </div>

      {/* Compact Token Info */}
      <div className='bg-pastels-polar-100/30 border-dark-neutral-50 flex items-center gap-2 rounded-md border p-3'>
        <CryptoIcon
          chain={token.chain}
          token={token.symbol}
          className='h-6 w-6'
        />
        <div className='flex-1 min-w-0'>
          <p className='text-dark-neutral-900 font-medium text-sm truncate'>
            {detectedTx
              ? `${(Number(detectedTx.value) / Math.pow(10, token.decimals)).toFixed(6)} ${token.symbol}`
              : `${token.symbol}`}
          </p>
          <p className='text-dark-neutral-600 text-xs truncate'>{token.name}</p>
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
        {!detectedTx && !isComplete && !hasFailed && (
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
            <Button
              onClick={() => {
                setHasStartedBridge(false);
                setError('');
                setDepositStatus('processing');
              }}
              size='sm'
              className='flex-1'
            >
              Retry
            </Button>
          </>
        )}

        {!isComplete && !hasFailed && detectedTx && (
          <Button
            disabled
            variant='outline'
            size='sm'
            className='flex-1'
          >
            Processing...
          </Button>
        )}
      </div>
    </div>
  );
}
