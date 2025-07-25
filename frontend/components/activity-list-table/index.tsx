import { useWallet } from '@solana/wallet-adapter-react';
import { useMemo } from 'react';

import { cn } from '@/lib/utils';
import { useIncomingTransfers } from '@/hooks/use-incoming-transfers';
import {
  formatTokenAmount,
  getTokenSymbol,
  formatUSDValue,
} from '@/lib/utils/token-formatting';
import { formatActivityDate } from '@/lib/utils/date-formatting';
import { getTransactionExplorerUrl } from '@/lib/utils/network-utils';

import { ActivityRow } from './activity-row';
import { TableHeader } from './table-header';

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
  timestampRaw?: number;
  status: 'pending' | 'completed';
  transactionHash?: string;
  explorerUrl?: string;
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
  const { connected } = useWallet();
  const {
    data: incomingTransfers,
    isLoading: isLoadingTransfers,
    error,
  } = useIncomingTransfers();

  const realTransactions: ActivityTransaction[] = useMemo(() => {
    if (!incomingTransfers) return [];

    return incomingTransfers.map(transfer => {
      const tokenSymbol = getTokenSymbol(transfer.tokenAddress);
      const formattedAmount = formatTokenAmount(
        transfer.value,
        transfer.tokenAddress,
        {
          showSymbol: true,
        },
      );

      const usdPrice = tokenSymbol === 'USDC' ? 1.0 : 0;
      const usdValue =
        usdPrice > 0
          ? formatUSDValue(transfer.value, transfer.tokenAddress, usdPrice)
          : '$0.00';

      return {
        id: `${transfer.transactionHash}-${transfer.logIndex}`,
        type: 'Deposit' as const,
        fromToken: {
          symbol: 'WALLET',
          chain: 'ethereum',
          amount: transfer.from,
          usdValue: '', // No USD value for address
        },
        toToken: {
          symbol: tokenSymbol,
          chain: 'ethereum',
          amount: formattedAmount,
          usdValue: usdValue,
        },
        address: transfer.from,
        timestamp: transfer.timestamp
          ? formatActivityDate(transfer.timestamp)
          : 'Unknown',
        timestampRaw: transfer.timestamp,
        status: 'completed' as const,
        transactionHash: transfer.transactionHash,
        explorerUrl: getTransactionExplorerUrl(
          transfer.transactionHash,
          'sepolia',
        ),
      };
    });
  }, [incomingTransfers]);

  // TODO: Add pagination for better UX when there are many transactions
  // Currently showing only the last 5 transactions to keep the UI clean
  const displayTransactions = realTransactions.slice(0, 5);

  return (
    <div>
      {error && (
        <div className='mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm'>
          <p className='text-red-800'>
            Error loading transfers: {error.message}
          </p>
        </div>
      )}

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
            {displayTransactions.length > 0 ? (
              displayTransactions.map(transaction => (
                <ActivityRow key={transaction.id} transaction={transaction} />
              ))
            ) : (
              <div className='flex items-center justify-center py-8 text-gray-500'>
                {connected
                  ? isLoadingTransfers
                    ? 'Loading transactions...'
                    : 'No transactions found. Send ERC20 tokens to your deposit address to see activity.'
                  : 'Connect your wallet to view transaction activity.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
