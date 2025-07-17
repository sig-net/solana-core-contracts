import { formatAddress } from '@/lib/address-utils';
import { formatTokenAmount } from '@/lib/program/utils';
import { AlertBox } from '@/components/ui/alert-box';
import { LoadingIndicator } from '@/components/ui/loading-indicator';
import type { UnclaimedTokenBalance } from '@/lib/types/token.types';

interface UnclaimedBalancesProps {
  balances: UnclaimedTokenBalance[];
  isLoading: boolean;
}

export function UnclaimedBalances({
  balances,
  isLoading,
}: UnclaimedBalancesProps) {
  if (isLoading) {
    return (
      <AlertBox variant='info' className='mt-4'>
        <LoadingIndicator message='Checking for unclaimed deposits...' />
      </AlertBox>
    );
  }

  if (balances.length === 0) {
    return null;
  }

  return (
    <AlertBox variant='warning' title='💰 Unclaimed Deposits' className='mt-4'>
      <p className='mb-3'>
        These tokens are available at your deposit address. Use the deposit flow
        below to claim them.
      </p>
      <div className='space-y-2'>
        {balances.map(balance => (
          <div
            key={balance.erc20Address}
            className='flex justify-between items-center text-sm'
          >
            <div className='flex items-center space-x-2'>
              <span className='text-yellow-800 dark:text-yellow-200 font-medium'>
                {balance.symbol}
              </span>
              <span className='text-yellow-600 dark:text-yellow-400 text-xs'>
                {formatAddress(balance.erc20Address)}
              </span>
            </div>
            <span className='font-mono font-medium text-yellow-800 dark:text-yellow-200'>
              {formatTokenAmount(balance.amount, balance.decimals)}
            </span>
          </div>
        ))}
      </div>
    </AlertBox>
  );
}
