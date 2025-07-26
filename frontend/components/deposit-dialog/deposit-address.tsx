'use client';

import { Copy, Check, Info } from 'lucide-react';
import { NetworkIcon } from '@web3icons/react';

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
    <div className='gradient-popover space-y-5'>
      <p className='text-dark-neutral-400 font-semibold capitalize'>
        {token.chainName} Address
      </p>

      {/* QR Code Container */}
      <div className='border-dark-neutral-400/80 gradient-bg-main flex flex-col justify-center gap-5 rounded-xs border p-5'>
        <QRCode
          value={depositAddress}
          size={242}
          icon={<NetworkIcon name={token.chain} />}
          className='mx-auto border-none bg-white'
          errorCorrectionLevel='M'
          margin={16}
        />

        {/* Address Display */}
        <div className='bg-pastels-swiss-coffee-50 mx-auto flex w-fit items-center gap-3 px-2 py-1'>
          <span className='text-dark-neutral-400 font-medium'>
            {formatAddress(depositAddress)}
          </span>
          <Button
            variant='ghost'
            size='icon'
            onClick={handleCopy}
            className={cn('text-dark-neutral-400 hover:text-dark-neutral-500')}
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
      <div className='flex items-center justify-center gap-2'>
        <Info className='h-4 w-4' />
        <p className='text-dark-neutral-400 text-center text-sm leading-relaxed'>
          Use this address to deposit {token.chainName}
        </p>
      </div>

      {/* Continue Button */}
      {onContinue && (
        <div className='flex gap-3'>
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
