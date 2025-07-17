import { Badge } from '@/components/ui/badge';
import { CopyButton } from '@/components/ui/copy-button';
import { formatAddress } from '@/lib/address-utils';

interface AddressDisplayProps {
  address: string;
  variant?: 'default' | 'compact' | 'full';
  showCopy?: boolean;
  className?: string;
}

export function AddressDisplay({
  address,
  variant = 'default',
  showCopy = true,
  className = '',
}: AddressDisplayProps) {
  if (variant === 'compact') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <span className='text-xs font-mono'>{formatAddress(address)}</span>
        {showCopy && <CopyButton text={address} size='sm' />}
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <div
        className={`flex items-center space-x-3 p-4 bg-muted/30 rounded-lg border border-dashed ${className}`}
      >
        <code className='flex-1 text-sm font-mono break-all select-all'>
          {address}
        </code>
        {showCopy && (
          <CopyButton text={address} variant='outline' showText size='sm' />
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <Badge variant='secondary' className='font-mono text-xs'>
        {formatAddress(address)}
      </Badge>
      {showCopy && <CopyButton text={address} />}
    </div>
  );
}
