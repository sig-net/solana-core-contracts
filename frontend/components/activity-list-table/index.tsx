import { useWallet } from '@solana/wallet-adapter-react';
import { useMemo, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useIncomingTransfers } from '@/hooks/use-incoming-transfers';
import { useOutgoingTransfers } from '@/hooks/use-outgoing-transfers';
import {
  getTokenInfoSync,
  preloadTokenInfo,
} from '@/lib/utils/token-formatting';
import { formatTokenBalanceSync } from '@/lib/utils/balance-formatter';
import { formatActivityDate } from '@/lib/utils/date-formatting';
import { getTransactionExplorerUrl } from '@/lib/utils/network-utils';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';

import { DetailsCell } from './details-cell';
import { StatusBadge } from './status-badge';

export interface ActivityTransaction {
  id: string;
  type: 'Send' | 'Swap' | 'Deposit' | 'Withdraw';
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

interface ActivityListTableProps {
  className?: string;
}

export function ActivityListTable({ className }: ActivityListTableProps) {
  const { connected } = useWallet();
  const {
    data: incomingTransfers,
    isLoading: isLoadingIncoming,
    error: incomingError,
  } = useIncomingTransfers();

  const {
    data: outgoingTransfers,
    isLoading: isLoadingOutgoing,
    error: outgoingError,
  } = useOutgoingTransfers();

  const isLoadingTransfers = isLoadingIncoming || isLoadingOutgoing;
  const error = incomingError || outgoingError;

  // Preload token information when transfers are loaded
  useEffect(() => {
    const allTransfers = [
      ...(incomingTransfers || []),
      ...(outgoingTransfers || []),
    ];
    if (allTransfers.length) {
      const tokenAddresses = Array.from(
        new Set(allTransfers.map(transfer => transfer.tokenAddress)),
      );
      preloadTokenInfo(tokenAddresses);
    }
  }, [incomingTransfers, outgoingTransfers]);

  const realTransactions: ActivityTransaction[] = useMemo(() => {
    const allTransactions: ActivityTransaction[] = [];

    // Process incoming transfers (deposits)
    if (incomingTransfers) {
      const incomingTxs = incomingTransfers.map(transfer => {
        const tokenInfo = getTokenInfoSync(transfer.tokenAddress);
        const formattedAmount = formatTokenBalanceSync(
          transfer.value,
          tokenInfo.decimals,
          tokenInfo.displaySymbol,
          { showSymbol: true },
        );

        // Calculate USD value for USDC (1:1 ratio)
        const usdPrice = tokenInfo.displaySymbol === 'USDC' ? 1.0 : 0;
        const usdValue =
          usdPrice > 0
            ? formatTokenBalanceSync(
                transfer.value,
                tokenInfo.decimals,
                undefined,
                { showUsd: true, usdPrice },
              )
            : '$0.00';

        return {
          id: `${transfer.transactionHash}-${transfer.logIndex}`,
          type: 'Deposit' as const,
          fromToken: {
            symbol: 'WALLET',
            chain: 'ethereum',
            amount: transfer.from,
            usdValue: '',
          },
          toToken: {
            symbol: tokenInfo.displaySymbol,
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
      allTransactions.push(...incomingTxs);
    }

    // Process outgoing transfers (withdrawals)
    if (outgoingTransfers) {
      const outgoingTxs = outgoingTransfers.map(transfer => {
        const tokenInfo = getTokenInfoSync(transfer.tokenAddress);
        const formattedAmount = formatTokenBalanceSync(
          transfer.value,
          tokenInfo.decimals,
          tokenInfo.displaySymbol,
          { showSymbol: true },
        );

        // Calculate USD value for USDC (1:1 ratio)
        const usdPrice = tokenInfo.displaySymbol === 'USDC' ? 1.0 : 0;
        const usdValue =
          usdPrice > 0
            ? formatTokenBalanceSync(
                transfer.value,
                tokenInfo.decimals,
                undefined,
                { showUsd: true, usdPrice },
              )
            : '$0.00';

        return {
          id: `${transfer.requestId}-outgoing`,
          type: 'Withdraw' as const,
          fromToken: {
            symbol: tokenInfo.displaySymbol,
            chain: 'ethereum',
            amount: formattedAmount,
            usdValue: usdValue,
          },
          toToken: {
            symbol: 'WALLET',
            chain: 'ethereum',
            amount: transfer.recipient,
            usdValue: '',
          },
          address: transfer.recipient,
          timestamp: transfer.timestamp
            ? formatActivityDate(transfer.timestamp)
            : 'Unknown',
          timestampRaw: transfer.timestamp,
          status: transfer.status as 'pending' | 'completed',
          transactionHash: transfer.transactionHash,
          explorerUrl: transfer.transactionHash
            ? getTransactionExplorerUrl(transfer.transactionHash, 'sepolia')
            : undefined,
        };
      });
      allTransactions.push(...outgoingTxs);
    }

    // Sort all transactions by timestamp (newest first)
    return allTransactions.sort((a, b) => {
      const aTime = a.timestampRaw || 0;
      const bTime = b.timestampRaw || 0;
      return bTime - aTime;
    });
  }, [incomingTransfers, outgoingTransfers]);

  // TODO: Add pagination for better UX when there are many transactions
  // Currently showing only the last 5 transactions to keep the UI clean
  const displayTransactions = realTransactions.slice(0, 5);

  return (
    <div className={cn('w-full', className)}>
      <div className='mb-6'>
        <h2 className='text-dark-neutral-200 self-start font-semibold uppercase'>
          Activity
        </h2>
      </div>

      {error && (
        <div className='mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm'>
          <p className='text-red-800'>
            Error loading transfers: {error.message}
          </p>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-20 sm:w-24'>Activity</TableHead>
            <TableHead>Details</TableHead>
            <TableHead className='w-20 sm:w-28'>
              <span className='hidden sm:inline'>Timestamp</span>
              <span className='sm:hidden'>Time</span>
            </TableHead>
            <TableHead className='w-20 sm:w-24'>Status</TableHead>
            <TableHead className='w-12 sm:w-16'>
              <span className='sr-only sm:not-sr-only'>Explorer</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoadingTransfers ? (
            // Loading skeleton with proper column structure
            Array.from({ length: 3 }).map((_, index) => (
              <TableRow key={`loading-${index}`}>
                <TableCell>
                  <div className='h-4 w-12 animate-pulse rounded bg-gray-200'></div>
                </TableCell>
                <TableCell>
                  <div className='flex items-center gap-2'>
                    <div className='h-8 w-8 animate-pulse rounded-full bg-gray-200'></div>
                    <div className='space-y-1'>
                      <div className='h-3 w-16 animate-pulse rounded bg-gray-200'></div>
                      <div className='h-3 w-20 animate-pulse rounded bg-gray-200'></div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className='h-4 w-12 animate-pulse rounded bg-gray-200'></div>
                </TableCell>
                <TableCell>
                  <div className='h-6 w-16 animate-pulse rounded-full bg-gray-200'></div>
                </TableCell>
                <TableCell>
                  <div className='h-4 w-4 animate-pulse rounded bg-gray-200'></div>
                </TableCell>
              </TableRow>
            ))
          ) : displayTransactions.length > 0 ? (
            displayTransactions.map(transaction => (
              <TableRow key={transaction.id}>
                <TableCell>
                  <div className='text-tundora-50 text-xs font-medium sm:text-sm'>
                    {transaction.type}
                  </div>
                </TableCell>
                <TableCell>
                  <DetailsCell transaction={transaction} />
                </TableCell>
                <TableCell>
                  <div className='text-xs font-medium text-stone-700 sm:text-sm'>
                    {transaction.timestamp}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={transaction.status} />
                </TableCell>
                <TableCell>
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
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className='py-8 text-center text-gray-500'>
                {connected
                  ? 'No transactions found. Send ERC20 tokens to your deposit address to see activity.'
                  : 'Connect your wallet to view transaction activity.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
