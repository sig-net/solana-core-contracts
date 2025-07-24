import { Download } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface BalancesSectionHeaderProps {
  onDepositClick?: () => void;
}

export function BalancesSectionHeader({
  onDepositClick,
}: BalancesSectionHeaderProps) {
  return (
    <div className='border-dark-neutral-300 flex w-full items-center justify-between border-t py-5'>
      <h2 className='text-dark-neutral-200 self-start font-semibold uppercase'>
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
