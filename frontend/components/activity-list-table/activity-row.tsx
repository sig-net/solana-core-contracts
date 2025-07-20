import { ExternalLink } from 'lucide-react';
import { COLUMN_WIDTHS, ActivityTransaction } from './index';
import { TableCell } from './table-cell';
import { DetailsCell } from './details-cell';
import { StatusBadge } from './status-badge';

interface ActivityRowProps {
  transaction: ActivityTransaction;
}

export function ActivityRow({ transaction }: ActivityRowProps) {
  return (
    <div className='flex w-full'>
      <TableCell width={COLUMN_WIDTHS.activity}>
        <div className=' font-medium text-sm leading-5 text-text-secondary'>
          {transaction.type}
        </div>
      </TableCell>

      <TableCell width={COLUMN_WIDTHS.details}>
        <DetailsCell transaction={transaction} />
      </TableCell>

      <TableCell width={COLUMN_WIDTHS.timestamp}>
        <div className=' font-medium text-sm leading-5 text-header-text-primary'>
          {transaction.timestamp}
        </div>
      </TableCell>

      <TableCell width={COLUMN_WIDTHS.status}>
        <StatusBadge status={transaction.status} />
      </TableCell>

      <TableCell width={COLUMN_WIDTHS.explorer}>
        <button className='w-5 h-5 hover:opacity-80 transition-opacity'>
          <ExternalLink className='w-5 h-5 text-text-secondary' />
        </button>
      </TableCell>
    </div>
  );
}
