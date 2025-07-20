'use client';

import { useState } from 'react';
import { Copy, Check, ArrowLeft } from 'lucide-react';

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

  const handleQRClick = () => {
    handleCopy();
  };

  return (
    <div className='space-y-6'>
      {/* Deposit Address */}
      <div className='space-y-3'>
        <div className='flex items-center gap-3 p-4 bg-pastels-polar-200 rounded-sm border border-dark-neutral-50'>
          <code className='flex-1 font-mono text-sm text-dark-neutral-500 font-medium'>
            {depositAddress}
          </code>
          <Button
            variant='ghost'
            size='sm'
            onClick={handleCopy}
            className={cn(
              'h-8 w-8 p-0 shrink-0 text-dark-neutral-300 hover:text-dark-neutral-500 hover:bg-white/60',
              copied && 'text-success-500',
            )}
          >
            {copied ? (
              <Check className='h-4 w-4' />
            ) : (
              <Copy className='h-4 w-4' />
            )}
          </Button>
        </div>

        {/* QR Code */}
        <div className='flex justify-center'>
          <div
            className='inline-block cursor-pointer transition-transform hover:scale-105'
            onClick={handleQRClick}
            role='button'
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleQRClick();
              }
            }}
          >
            <QRCode
              value={depositAddress}
              size={200}
              network={token.chain}
              className='mx-auto'
              errorCorrectionLevel='M'
            />
          </div>
        </div>

        {/* Copy Feedback */}
        {copied && (
          <p className='text-xs text-success-500 text-center font-medium'>
            Address copied to clipboard
          </p>
        )}
      </div>
    </div>
  );
}
