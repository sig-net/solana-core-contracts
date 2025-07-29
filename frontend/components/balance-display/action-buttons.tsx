'use client';

import { ArrowUpDown, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface ActionButtonsProps {
  onSwapClick?: () => void;
  onSendClick?: () => void;
}

export function ActionButtons({
  onSwapClick,
  onSendClick,
}: ActionButtonsProps) {
  return (
    <div className='flex items-center gap-4'>
      <Button variant='default' size='default' disabled onClick={onSwapClick}>
        <ArrowUpDown className='h-3 w-3' />
        Swap
      </Button>
      <Button variant='secondary' size='default' onClick={onSendClick}>
        <Send className='h-3 w-3' />
        Send
      </Button>
    </div>
  );
}
