'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Send, Zap, CheckCircle } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';

import { Button } from '@/components/ui/button';
import { Steps, Step } from '@/components/ui/steps';
import { CryptoIcon } from '@/components/balance-display/crypto-icon';
import { DepositTokenMetadata } from '@/lib/constants/token-metadata';
import { useDepositErc20Mutation } from '@/hooks/use-deposit-erc20-mutation';
import { useSolanaService } from '@/hooks/use-solana-service';
import { DepositStatus } from '@/lib/types/bridge.types';

interface DepositStepsProps {
  token: DepositTokenMetadata;
  onBack: () => void;
  onClose: () => void;
}

export function DepositSteps({ token, onBack, onClose }: DepositStepsProps) {
  const { publicKey } = useWallet();
  const depositMutation = useDepositErc20Mutation();
  const solanaService = useSolanaService();

  const [depositStatus, setDepositStatus] =
    useState<DepositStatus>('processing');
  const [txHash, setTxHash] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [hasStartedBridge, setHasStartedBridge] = useState(false);
  const [availableBalance, setAvailableBalance] = useState<string>('');
  const [actualDecimals, setActualDecimals] = useState<number | null>(null);
  const [checkingBalance, setCheckingBalance] = useState(true);

  // Check for available balance and start auto-deposit if found
  useEffect(() => {
    const checkAvailableBalance = async () => {
      if (!publicKey || !checkingBalance) return;

      try {
        const balanceResult = await solanaService.getAdjustedAvailableBalance(
          publicKey,
          token.address,
        );

        if (balanceResult.amount && parseFloat(balanceResult.amount) > 0) {
          setAvailableBalance(balanceResult.amount);
          setActualDecimals(balanceResult.decimals);
        }
      } catch (error) {
        // No balance available, continue with normal flow
        // No available balance to auto-claim, proceed with normal deposit flow
      } finally {
        setCheckingBalance(false);
      }
    };

    checkAvailableBalance();
  }, [
    publicKey,
    token.address,
    token.decimals,
    solanaService,
    checkingBalance,
  ]);

  // Auto-start bridge process when available balance is found
  useEffect(() => {
    if (
      availableBalance &&
      parseFloat(availableBalance) > 0 &&
      !hasStartedBridge &&
      publicKey
    ) {
      const startBridge = async () => {
        setHasStartedBridge(true);

        try {
          await depositMutation.mutateAsync({
            erc20Address: token.address,
            amount: availableBalance,
            decimals: actualDecimals || token.decimals,
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

      // Start bridge process immediately when balance is available
      startBridge();
    }
  }, [
    availableBalance,
    hasStartedBridge,
    publicKey,
    depositMutation,
    token,
    actualDecimals,
  ]);

  const getSteps = (): Step[] => {
    const baseSteps: Step[] = [
      {
        id: 'send',
        title: 'Balance detected',
        description: `${token.symbol} available for deposit`,
        status:
          availableBalance && parseFloat(availableBalance) > 0
            ? 'completed'
            : checkingBalance
              ? 'loading'
              : 'pending',
        icon: Send,
      },
      {
        id: 'bridge',
        title: 'Processing Deposit',
        description: 'MPC signature & transaction submission',
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
            View transaction
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
          className='size-6'
        />
        <div className='min-w-0 flex-1'>
          <p className='text-dark-neutral-900 truncate text-sm font-medium'>
            {availableBalance && parseFloat(availableBalance) > 0
              ? `${parseFloat(availableBalance).toFixed(6)} ${token.symbol}`
              : `${token.symbol}`}
          </p>
          <p className='text-dark-neutral-600 truncate text-xs'>{token.name}</p>
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
        {(!availableBalance || parseFloat(availableBalance) === 0) &&
          !isComplete &&
          !hasFailed && (
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

        {!isComplete &&
          !hasFailed &&
          availableBalance &&
          parseFloat(availableBalance) > 0 && (
            <Button disabled variant='outline' size='sm' className='flex-1'>
              Processing...
            </Button>
          )}
      </div>
    </div>
  );
}
