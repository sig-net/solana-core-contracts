'use client';

import { useState } from 'react';
import { Copy, Check, ArrowLeft, Eye } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { QRCode } from '@/components/ui/qr-code';
import { DepositToken } from '@/lib/constants/deposit-tokens';
import { cn } from '@/lib/utils';

interface DepositAddressProps {
  token: DepositToken;
  onBack: () => void;
  depositAddress: string;
}

export function DepositAddress({
  token,
  onBack,
  depositAddress,
}: DepositAddressProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(depositAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className='space-y-8'>
      {/* Header */}
      <div className='flex items-center gap-3'>
        <Button variant='ghost' size='icon' onClick={onBack}>
          <ArrowLeft className='h-5 w-5' />
        </Button>
        <div>
          <h3 className='text-tundora-300 text-xl font-semibold'>
            Your {token.chainName} address
          </h3>
          <p className='text-dark-neutral-400 text-sm mt-1'>
            Deposit to 💳 Wallet
          </p>
        </div>
      </div>

      {/* QR Code Container */}
      <div className='flex justify-center'>
        <div className='bg-white rounded-2xl p-6 border border-dark-neutral-50 shadow-sm'>
          <QRCode
            value={depositAddress}
            size={280}
            network={token.chain}
            tokenSymbol={token.symbol}
            className='mx-auto'
            errorCorrectionLevel='M'
          />
        </div>
      </div>

      {/* Address Display */}
      <div className='flex items-center justify-center gap-3'>
        <div className='flex items-center gap-3 bg-pastels-polar-200 rounded-full px-6 py-3 border border-dark-neutral-50'>
          <Eye className='h-4 w-4 text-dark-neutral-400' />
          <span className='text-tundora-300 font-mono text-sm font-medium'>
            {formatAddress(depositAddress)}
          </span>
        </div>
        <Button
          variant='ghost'
          size='icon'
          onClick={handleCopy}
          className={cn(
            'h-12 w-12 rounded-full bg-pastels-polar-200 border border-dark-neutral-50 text-dark-neutral-400 hover:bg-pastels-polar-100 hover:text-tundora-300',
            copied && 'text-success-500',
          )}
        >
          {copied ? (
            <Check className='h-5 w-5' />
          ) : (
            <Copy className='h-5 w-5' />
          )}
        </Button>
      </div>

      {/* Description */}
      <p className='text-center text-dark-neutral-400 text-sm leading-relaxed'>
        Use this address to deposit tokens and collectibles on {token.chainName}
      </p>

      {/* Copy Feedback */}
      {copied && (
        <p className='text-xs text-success-500 text-center font-medium'>
          Address copied to clipboard
        </p>
      )}
    </div>
  );
}
