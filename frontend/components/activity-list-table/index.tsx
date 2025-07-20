import { cn } from '@/lib/utils';
import { ACTIVITY_DATA } from './mockdata';
import { TableHeader } from './table-header';
import { ActivityRow } from './activity-row';

export interface ActivityTransaction {
  id: string;
  type: 'Send' | 'Swap' | 'Deposit';
  fromToken?: {
    symbol: string;
    chain: string;
    amount: string;
    usdValue: string;
  };
  toToken?: {
    symbol: string;
    chain: string;
    amount: string;
    usdValue: string;
  };
  address?: string;
  timestamp: string;
  status: 'pending' | 'completed';
}

export const COLUMN_WIDTHS = {
  activity: 'w-24',
  details: 'flex-1',
  timestamp: 'w-50',
  status: 'w-32',
  explorer: 'w-25',
} as const;

interface ActivityListTableProps {
  className?: string;
}

export function ActivityListTable({ className }: ActivityListTableProps) {
  return (
    <div>
      <p className='text-dark-neutral-200 font-bold uppercase mb-8'>Activity</p>
      <div className={cn('w-full', className)}>
        <div className='flex flex-col'>
          {/* Headers */}
          <div className='flex w-full'>
            <TableHeader width={COLUMN_WIDTHS.activity}>Activity</TableHeader>
            <TableHeader width={COLUMN_WIDTHS.details}>Details</TableHeader>
            <TableHeader width={COLUMN_WIDTHS.timestamp}>Timestamp</TableHeader>
            <TableHeader width={COLUMN_WIDTHS.status}>Status</TableHeader>
            <TableHeader width={COLUMN_WIDTHS.explorer}>Explorer</TableHeader>
          </div>

          {/* Rows */}
          <div className='flex flex-col'>
            {ACTIVITY_DATA.map(transaction => (
              <ActivityRow key={transaction.id} transaction={transaction} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
