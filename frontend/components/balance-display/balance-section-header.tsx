import { Download } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface BalancesSectionHeaderProps {
  onDepositClick?: () => void;
}

export function BalancesSectionHeader({
  onDepositClick,
}: BalancesSectionHeaderProps) {
  return (
    <div className='flex items-center justify-between py-5 w-full border-t border-dark-neutral-300'>
      <h2 className='font-semibold text-dark-neutral-200 self-start uppercase'>
        Balances
      </h2>
      <Button
        onClick={onDepositClick}
        variant='outline'
        size='lg'
        className='gap-1.5 font-semibold'
      >
        <Download className='h-4 w-4' />
        Deposit
      </Button>
    </div>
  );
}
