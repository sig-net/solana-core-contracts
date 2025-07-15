import { Badge } from '@/components/ui/badge';
import { CopyButton } from '@/components/ui/copy-button';

interface AddressDisplayProps {
  address: string;
  label?: string;
  showFull?: boolean;
  className?: string;
}

export function AddressDisplay({
  address,
  label,
  showFull = false,
  className,
}: AddressDisplayProps) {
  const formatAddress = (addr: string) => {
    if (showFull) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className={className}>
      {label && (
        <label className='text-sm font-medium text-muted-foreground block mb-2'>
          {label}
        </label>
      )}
      <div className='flex items-center space-x-2'>
        <Badge variant='secondary' className='font-mono text-xs'>
          {formatAddress(address)}
        </Badge>
        <CopyButton text={address} />
      </div>
    </div>
  );
}
