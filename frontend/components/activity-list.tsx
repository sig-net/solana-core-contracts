'use client';

import { ArrowUpRight, ArrowDownLeft, Clock, Wallet, Zap } from 'lucide-react';

import { cn } from '@/lib/utils';

// Helper function to format relative time
function formatDistanceToNow(date: Date): string {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 1) return 'just now';
  if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
  if (diffInHours < 24) return `${diffInHours} hours ago`;
  if (diffInDays === 1) return 'yesterday';
  return `${diffInDays} days ago`;
}

// Cell type definitions
export type CellType =
  | 'text'
  | 'icon-text'
  | 'badge'
  | 'crypto-token'
  | 'wallet-icon';

export interface CellData {
  type: CellType;
  value: string;
  icon?: React.ReactNode;
  supportingText?: string;
  badgeStyle?: 'default' | 'success' | 'warning' | 'error';
  cryptoSymbol?: string;
}

export interface TableRow {
  id: string;
  cells: CellData[];
}

export interface ActivityListTableProps {
  headers: string[];
  rows: TableRow[];
  className?: string;
  emptyStateMessage?: string;
}

// Column widths from Figma specifications
const COLUMN_WIDTHS = ['98px', 'flex-1', '187px', '126px', '131px'];

// Icon components for different transaction types
function TransactionIcon({ type }: { type: string }) {
  switch (type.toLowerCase()) {
    case 'deposit':
      return <ArrowDownLeft className='h-5 w-5 text-green-600' />;
    case 'withdraw':
      return <ArrowUpRight className='h-5 w-5 text-orange-600' />;
    case 'swap':
      return <Zap className='h-5 w-5 text-blue-600' />;
    case 'wallet':
      return <Wallet className='h-5 w-5 text-gray-600' />;
    default:
      return <Clock className='h-5 w-5 text-gray-600' />;
  }
}

// Crypto token icon component
function CryptoIcon({ symbol }: { symbol: string }) {
  const getIconStyle = (symbol: string) => {
    switch (symbol.toUpperCase()) {
      case 'BTC':
        return 'bg-orange-100 text-orange-600';
      case 'ETH':
        return 'bg-blue-100 text-blue-600';
      case 'USDC':
        return 'bg-blue-100 text-blue-600';
      case 'USDT':
        return 'bg-green-100 text-green-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
        getIconStyle(symbol),
      )}
    >
      {symbol.slice(0, 2).toUpperCase()}
    </div>
  );
}

// Badge component with different styles
function Badge({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error';
}) {
  const variants = {
    default: 'bg-[#F6FDFD] border-[#C6B3B2] text-gray-700',
    success: 'bg-green-50 border-green-200 text-green-700',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    error: 'bg-red-50 border-red-200 text-red-700',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium',
        variants[variant],
      )}
    >
      {children}
    </span>
  );
}

// Cell renderer component
function TableCell({
  data,
  columnIndex: _columnIndex,
}: {
  data: CellData;
  columnIndex: number;
}) {
  const baseStyles = 'px-6 py-4 border-b border-[rgba(156,134,134,0.5)]';

  switch (data.type) {
    case 'icon-text':
      return (
        <td className={baseStyles}>
          <div className='flex items-center gap-3'>
            {data.icon || <TransactionIcon type={data.value} />}
            <div>
              <div className='text-sm font-medium text-gray-900'>
                {data.value}
              </div>
              {data.supportingText && (
                <div className='text-sm text-gray-500'>
                  {data.supportingText}
                </div>
              )}
            </div>
          </div>
        </td>
      );

    case 'badge':
      return (
        <td className={baseStyles}>
          <Badge variant={data.badgeStyle}>{data.value}</Badge>
        </td>
      );

    case 'crypto-token':
      return (
        <td className={baseStyles}>
          <div className='flex items-center gap-3'>
            <CryptoIcon symbol={data.cryptoSymbol || data.value} />
            <span className='text-sm font-medium text-gray-900'>
              {data.value}
            </span>
          </div>
        </td>
      );

    case 'wallet-icon':
      return (
        <td className={baseStyles}>
          <div className='flex items-center gap-3'>
            <Wallet className='h-5 w-5 text-gray-600' />
            <span className='text-sm font-medium text-gray-900'>
              {data.value}
            </span>
          </div>
        </td>
      );

    default: // 'text'
      return (
        <td className={baseStyles}>
          <div className='text-sm text-gray-900'>{data.value}</div>
          {data.supportingText && (
            <div className='text-sm text-gray-500'>{data.supportingText}</div>
          )}
        </td>
      );
  }
}

// Header cell component
function HeaderCell({
  children,
  columnIndex,
}: {
  children: React.ReactNode;
  columnIndex: number;
}) {
  return (
    <th
      className='px-6 py-3 border-b-2 border-[#9C8686] text-left text-sm font-medium text-gray-700 bg-gray-50'
      style={{ width: COLUMN_WIDTHS[columnIndex] }}
    >
      {children}
    </th>
  );
}

// Main ActivityListTable component
export function ActivityListTable({
  headers,
  rows,
  className,
  emptyStateMessage = 'No activity to display',
}: ActivityListTableProps) {
  return (
    <div className={cn('w-full', className)}>
      <div className='overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm'>
        <table className='min-w-full divide-y divide-gray-200'>
          <thead>
            <tr>
              {headers.map((header, index) => (
                <HeaderCell key={index} columnIndex={index}>
                  {header}
                </HeaderCell>
              ))}
            </tr>
          </thead>
          <tbody className='divide-y divide-gray-200 bg-white'>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={headers.length}
                  className='px-6 py-12 text-center text-sm text-gray-500'
                >
                  <Clock className='mx-auto mb-3 h-12 w-12 text-gray-400' />
                  {emptyStateMessage}
                </td>
              </tr>
            ) : (
              rows.map(row => (
                <tr key={row.id} className='hover:bg-gray-50 transition-colors'>
                  {row.cells.map((cell, cellIndex) => (
                    <TableCell
                      key={cellIndex}
                      data={cell}
                      columnIndex={cellIndex}
                    />
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Convenience wrapper that maintains the original ActivityList interface
interface Transaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'swap';
  status: 'completed' | 'pending' | 'failed';
  from: string;
  to: string;
  amount: string;
  token: string;
  timestamp: Date;
  txHash?: string;
}

interface ActivityListProps {
  transactions?: Transaction[];
  className?: string;
}

const mockTransactions: Transaction[] = [
  {
    id: '1',
    type: 'deposit',
    status: 'completed',
    from: 'Ethereum',
    to: 'Solana',
    amount: '100',
    token: 'USDC',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    txHash: '0x123...',
  },
  {
    id: '2',
    type: 'withdraw',
    status: 'pending',
    from: 'Solana',
    to: 'Ethereum',
    amount: '50',
    token: 'USDT',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
  },
  {
    id: '3',
    type: 'deposit',
    status: 'completed',
    from: 'Ethereum',
    to: 'Solana',
    amount: '200',
    token: 'DAI',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
    txHash: '0x456...',
  },
];

function transactionToTableRow(tx: Transaction): TableRow {
  const statusVariant =
    tx.status === 'completed'
      ? 'success'
      : tx.status === 'pending'
        ? 'warning'
        : 'error';

  return {
    id: tx.id,
    cells: [
      {
        type: 'icon-text',
        value: tx.type.charAt(0).toUpperCase() + tx.type.slice(1),
        supportingText: `${tx.from} → ${tx.to}`,
      },
      {
        type: 'crypto-token',
        value: tx.token,
        cryptoSymbol: tx.token,
      },
      {
        type: 'text',
        value: `${tx.amount} ${tx.token}`,
        supportingText: formatDistanceToNow(tx.timestamp),
      },
      {
        type: 'badge',
        value: tx.status.charAt(0).toUpperCase() + tx.status.slice(1),
        badgeStyle: statusVariant,
      },
      {
        type: 'text',
        value: tx.txHash || '—',
      },
    ],
  };
}

export function ActivityList({
  transactions = mockTransactions,
  className,
}: ActivityListProps) {
  const headers = ['Type', 'Token', 'Amount', 'Status', 'Transaction'];
  const rows = transactions.map(transactionToTableRow);

  return (
    <div className={cn('w-full', className)}>
      <h3 className='mb-4 text-lg font-semibold text-gray-900'>
        Recent Activity
      </h3>
      <ActivityListTable
        headers={headers}
        rows={rows}
        emptyStateMessage='No transactions yet'
      />
    </div>
  );
}
