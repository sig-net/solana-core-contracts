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
    <div className='border-dark-neutral-50/80 flex items-center gap-2.5 rounded-sm border px-2 py-1'>
      <Button
        onClick={onTokenSelect}
        variant='ghost'
        className='text-dark-neutral-400 h-auto p-0'
      >
        {selectedToken ? selectedToken.symbol : 'Select Token'}
      </Button>
      <ChevronDown className='text-dark-neutral-400 h-5 w-5' />
    </div>
  );
}
