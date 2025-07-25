import { ExternalLink } from 'lucide-react';

import { TableCell } from './table-cell';
import { DetailsCell } from './details-cell';
import { StatusBadge } from './status-badge';

import { COLUMN_WIDTHS, ActivityTransaction } from './index';

interface ActivityRowProps {
  transaction: ActivityTransaction;
}

export function ActivityRow({ transaction }: ActivityRowProps) {
  return (
    <div className='flex w-full'>
      <TableCell width={COLUMN_WIDTHS.activity}>
        <div className='text-tundora-50 text-sm leading-5 font-medium'>
          {transaction.type}
        </div>
      </TableCell>

      <TableCell width={COLUMN_WIDTHS.details}>
        <DetailsCell transaction={transaction} />
      </TableCell>

      <TableCell width={COLUMN_WIDTHS.timestamp}>
        <div className='text-sm leading-5 font-medium text-stone-700'>
          {transaction.timestamp}
        </div>
      </TableCell>

      <TableCell width={COLUMN_WIDTHS.status}>
        <StatusBadge status={transaction.status} />
      </TableCell>

      <TableCell width={COLUMN_WIDTHS.explorer}>
        {transaction.explorerUrl ? (
          <a
            href={transaction.explorerUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='inline-block h-5 w-5 transition-opacity hover:opacity-80'
          >
            <ExternalLink className='text-tundora-50 h-5 w-5' />
          </a>
        ) : null}
      </TableCell>
    </div>
  );
}
