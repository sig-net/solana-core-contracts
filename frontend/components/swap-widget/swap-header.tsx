import { Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface SwapHeaderProps {
  onSettingsClick: () => void;
}

export function SwapHeader({ onSettingsClick }: SwapHeaderProps) {
  return (
    <div className='flex items-center justify-between'>
      <h2 className='text-tundora-400 text-xl font-semibold'>Swap</h2>
      <Button
        variant='ghost'
        size='icon'
        className='h-8 w-8 p-0'
        onClick={onSettingsClick}
      >
        <Settings2 className='text-dark-neutral-300 h-8 w-8' />
      </Button>
    </div>
  );
}
