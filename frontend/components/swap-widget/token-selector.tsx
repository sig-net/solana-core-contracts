import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TokenMetadata } from '@/lib/constants/token-metadata';

interface TokenSelectorProps {
  selectedToken: TokenMetadata | null;
  onTokenSelect: () => void;
}

export function TokenSelector({
  selectedToken,
  onTokenSelect,
}: TokenSelectorProps) {
  return (
    <div className='flex items-center gap-2.5 border border-dark-neutral-50/80 rounded-sm px-2 py-1'>
      <Button
        onClick={onTokenSelect}
        variant='ghost'
        className='h-auto p-0 text-dark-neutral-400'
      >
        {selectedToken ? selectedToken.symbol : 'Select Token'}
      </Button>
      <ChevronDown className='h-5 w-5 text-dark-neutral-400' />
    </div>
  );
}
