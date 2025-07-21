'use client';

import { CheckCircle, Clock, XCircle, Loader2, ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CryptoIcon } from '@/components/balance-display/crypto-icon';
import { WithdrawToken } from './index';

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

interface WithdrawProcessingProps {
  token: WithdrawToken;
  amount: string;
  recipientAddress: string;
  status: WithdrawStatus;
  txHash?: string;
  error?: string;
  onRetry?: () => void;
  onClose: () => void;
}

const statusConfig = {
  processing: {
    icon: Loader2,
    iconClass: 'text-blue-500 animate-spin',
    title: 'Processing Withdrawal',
    description: 'Initiating withdrawal transaction...',
    showProgress: true,
  },
  waiting_signature: {
    icon: Clock,
    iconClass: 'text-yellow-500',
    title: 'Waiting for Signature',
    description: 'MPC network is signing the withdrawal transaction...',
    showProgress: true,
  },
  submitting_ethereum: {
    icon: Loader2,
    iconClass: 'text-blue-500 animate-spin',
    title: 'Submitting to Ethereum',
    description: 'Sending signed transaction to Ethereum network...',
    showProgress: true,
  },
  confirming_ethereum: {
    icon: Clock,
    iconClass: 'text-yellow-500',
    title: 'Confirming Transaction',
    description: 'Waiting for Ethereum network confirmation...',
    showProgress: true,
  },
  waiting_read_response: {
    icon: Clock,
    iconClass: 'text-yellow-500',
    title: 'Reading Transaction',
    description: 'MPC network is reading the transaction receipt...',
    showProgress: true,
  },
  completing_withdrawal: {
    icon: Loader2,
    iconClass: 'text-green-500 animate-spin',
    title: 'Completing Withdrawal',
    description: 'Finalizing withdrawal on Solana...',
    showProgress: true,
  },
  completed: {
    icon: CheckCircle,
    iconClass: 'text-green-500',
    title: 'Withdrawal Completed!',
    description: 'Your tokens have been successfully sent to Ethereum.',
    showProgress: false,
  },
  failed: {
    icon: XCircle,
    iconClass: 'text-red-500',
    title: 'Withdrawal Failed',
    description: 'The withdrawal process encountered an error.',
    showProgress: false,
  },
  complete_failed: {
    icon: XCircle,
    iconClass: 'text-orange-500',
    title: 'Completion Failed',
    description: 'Withdrawal succeeded but completion failed. You can retry completion.',
    showProgress: false,
  },
  processing_interrupted: {
    icon: XCircle,
    iconClass: 'text-orange-500',
    title: 'Process Interrupted',
    description: 'The process was interrupted but may have completed successfully.',
    showProgress: false,
  },
};

export function WithdrawProcessing({
  token,
  amount,
  recipientAddress,
  status,
  txHash,
  error,
  onRetry,
  onClose,
}: WithdrawProcessingProps) {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="space-y-4">
      <div className="text-center space-y-3">
        {/* Status Icon */}
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            <StatusIcon className={`w-6 h-6 ${config.iconClass}`} />
          </div>
        </div>

        {/* Title and Description */}
        <div>
          <h2 className="text-lg font-semibold text-dark-neutral-900 mb-1">
            {config.title}
          </h2>
          <p className="text-dark-neutral-600">
            {config.description}
          </p>
          {error && (
            <p className="text-red-600 text-sm mt-2 font-medium">
              {error}
            </p>
          )}
        </div>
      </div>

      {/* Transaction Hash */}
      {txHash && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-blue-900">
              Transaction Hash:
            </span>
            <a
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm cursor-pointer"
            >
              View on Etherscan
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="mt-2 p-2 bg-white rounded border break-all font-mono text-xs text-blue-800">
            {txHash}
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {config.showProgress && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-dark-neutral-600">
            <span>Progress</span>
            <span>
              {status === 'processing' && '10%'}
              {status === 'waiting_signature' && '25%'}
              {status === 'submitting_ethereum' && '50%'}
              {status === 'confirming_ethereum' && '70%'}
              {status === 'waiting_read_response' && '85%'}
              {status === 'completing_withdrawal' && '95%'}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{
                width:
                  status === 'processing' ? '10%' :
                  status === 'waiting_signature' ? '25%' :
                  status === 'submitting_ethereum' ? '50%' :
                  status === 'confirming_ethereum' ? '70%' :
                  status === 'waiting_read_response' ? '85%' :
                  status === 'completing_withdrawal' ? '95%' : '0%'
              }}
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        {status === 'completed' && (
          <Button
            onClick={onClose}
            className="flex-1 cursor-pointer"
          >
            Done
          </Button>
        )}

        {(status === 'failed' || status === 'complete_failed') && onRetry && (
          <>
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 cursor-pointer"
            >
              Close
            </Button>
            <Button
              onClick={onRetry}
              className="flex-1 cursor-pointer"
            >
              Retry
            </Button>
          </>
        )}

        {status === 'processing_interrupted' && (
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 cursor-pointer"
          >
            Close
          </Button>
        )}

        {config.showProgress && (
          <Button
            onClick={onClose}
            variant="outline"
            disabled
            className="flex-1 cursor-not-allowed"
          >
            Processing...
          </Button>
        )}
      </div>
    </div>
  );
}