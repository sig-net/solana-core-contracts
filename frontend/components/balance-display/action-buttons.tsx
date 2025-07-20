'use client';

import { Button } from '@/components/ui/button';
import { ArrowUpDown, Send } from 'lucide-react';

export function ActionButtons() {
  return (
    <div className='flex items-center gap-4'>
      <Button variant='default' size='default'>
        <ArrowUpDown className='h-3 w-3' />
        Swap
      </Button>
      <Button variant='secondary' size='default'>
        <Send className='h-3 w-3' />
        Send
      </Button>
    </div>
  );
}
