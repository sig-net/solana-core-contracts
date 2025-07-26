'use client';

import { Copy, Check, ArrowLeft, Eye } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { QRCode } from '@/components/ui/qr-code';
import { DepositToken } from '@/lib/constants/deposit-tokens';
import { useCopyToClipboard } from '@/hooks';
import { cn } from '@/lib/utils';

interface DepositAddressProps {
  token: DepositToken;
  onBack: () => void;
  depositAddress: string;
  onContinue?: () => void;
}

export function DepositAddress({
  token,
  onBack,
  depositAddress,
  onContinue,
}: DepositAddressProps) {
  const { isCopied, copyToClipboard, error } = useCopyToClipboard();

  const handleCopy = () => {
    copyToClipboard(depositAddress);
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className='gradient-popover space-y-8'>
      <p className='text-dark-neutral-400 font-semibold capitalize'>
        {token.chainName} Address
      </p>

      {/* QR Code Container */}
      <div className='border-dark-neutral-400/80 gradient-bg-main flex flex-col justify-center gap-5 rounded-xs border p-5'>
        <QRCode
          value={depositAddress}
          size={320}
          network={token.chain}
          tokenSymbol={token.symbol}
          className='mx-auto border-none bg-white'
          errorCorrectionLevel='M'
        />
        {/* Address Display */}
        <div className='flex items-center justify-center gap-3'>
          <div className='bg-pastels-polar-200 border-dark-neutral-50 flex items-center gap-3 rounded-full border px-6 py-3'>
            <span className='text-tundora-300 font-mono text-sm font-medium'>
              {formatAddress(depositAddress)}
            </span>
          </div>
          <Button
            variant='ghost'
            size='icon'
            onClick={handleCopy}
            className={cn(
              'bg-pastels-polar-200 border-dark-neutral-50 text-dark-neutral-400 hover:bg-pastels-polar-100 hover:text-tundora-300 h-12 w-12 cursor-pointer rounded-full border',
              isCopied && 'text-success-500',
            )}
          >
            {isCopied ? (
              <Check className='h-5 w-5' />
            ) : (
              <Copy className='h-5 w-5' />
            )}
          </Button>
        </div>
      </div>

      {/* Description */}
      <p className='text-dark-neutral-400 text-center text-sm leading-relaxed'>
        Use this address to deposit {token.chainName}
      </p>

      {/* Continue Button */}
      {onContinue && (
        <div className='flex gap-3 pt-4'>
          <Button
            onClick={onBack}
            variant='outline'
            className='flex-1 cursor-pointer'
          >
            Back
          </Button>
          <Button onClick={onContinue} className='flex-1 cursor-pointer'>
            I've sent the tokens
          </Button>
        </div>
      )}
    </div>
  );
}
