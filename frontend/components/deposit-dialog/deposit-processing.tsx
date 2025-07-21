'use client';

import { CheckCircle, Clock, XCircle, Loader2, ExternalLink } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CryptoIcon } from '@/components/balance-display/crypto-icon';
import { DepositToken } from '@/lib/constants/deposit-tokens';

export type DepositStatus = 
  | 'processing'
  | 'waiting_signature' 
  | 'submitting_ethereum'
  | 'confirming_ethereum'
  | 'waiting_read_response'
  | 'auto_claiming'
  | 'completed'
  | 'failed'
  | 'claim_failed'
  | 'processing_interrupted';

interface DepositProcessingProps {
  token: DepositToken;
  amount: string;
  status: DepositStatus;
  txHash?: string;
  error?: string;
  onRetry?: () => void;
  onClose: () => void;
}

const statusConfig = {
  processing: {
    icon: Loader2,
    iconClass: 'text-blue-500 animate-spin',
    title: 'Processing Deposit',
    description: 'Initiating deposit transaction...',
    showProgress: true,
  },
  waiting_signature: {
    icon: Clock,
    iconClass: 'text-yellow-500',
    title: 'Waiting for Signature',
    description: 'MPC network is signing the transaction...',
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
  auto_claiming: {
    icon: Loader2,
    iconClass: 'text-green-500 animate-spin',
    title: 'Claiming Tokens',
    description: 'Automatically claiming tokens to your Solana balance...',
    showProgress: true,
  },
  completed: {
    icon: CheckCircle,
    iconClass: 'text-green-500',
    title: 'Deposit Completed!',
    description: 'Your tokens have been successfully bridged to Solana.',
    showProgress: false,
  },
  failed: {
    icon: XCircle,
    iconClass: 'text-red-500',
    title: 'Deposit Failed',
    description: 'The deposit process encountered an error.',
    showProgress: false,
  },
  claim_failed: {
    icon: XCircle,
    iconClass: 'text-orange-500',
    title: 'Claim Failed',
    description: 'Deposit succeeded but claiming failed. You can retry claiming.',
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

export function DepositProcessing({
  token,
  amount,
  status,
  txHash,
  error,
  onRetry,
  onClose,
}: DepositProcessingProps) {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        {/* Status Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <StatusIcon className={`w-8 h-8 ${config.iconClass}`} />
          </div>
        </div>

        {/* Title and Description */}
        <div>
          <h2 className="text-xl font-semibold text-dark-neutral-900 mb-2">
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

      {/* Transaction Details */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 bg-pastels-polar-100/30 rounded-lg border border-dark-neutral-50">
          <CryptoIcon
            chain={token.chain}
            token={token.symbol}
            className="w-8 h-8"
          />
          <div className="flex-1">
            <p className="font-semibold text-dark-neutral-900">
              {amount} {token.symbol}
            </p>
            <p className="text-sm text-dark-neutral-600">{token.name}</p>
          </div>
        </div>

        {/* Transaction Hash */}
        {txHash && (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-blue-900">
                Transaction Hash:
              </span>
              <a
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
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
      </div>

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
              {status === 'auto_claiming' && '95%'}
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
                  status === 'auto_claiming' ? '95%' : '0%'
              }}
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        {status === 'completed' && (
          <Button
            onClick={onClose}
            className="flex-1"
          >
            Done
          </Button>
        )}

        {(status === 'failed' || status === 'claim_failed') && onRetry && (
          <>
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              Close
            </Button>
            <Button
              onClick={onRetry}
              className="flex-1"
            >
              Retry
            </Button>
          </>
        )}

        {status === 'processing_interrupted' && (
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1"
          >
            Close
          </Button>
        )}

        {config.showProgress && (
          <Button
            onClick={onClose}
            variant="outline"
            disabled
            className="flex-1"
          >
            Processing...
          </Button>
        )}
      </div>
    </div>
  );
}