'use client';

import { Clock, AlertTriangle, Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { CopyButton } from '@/components/ui/copy-button';
import { formatAddress } from '@/lib/address-utils';
import { formatTokenAmount } from '@/lib/program/utils';

export interface PendingDeposit {
  requestId: string;
  amount: string;
  erc20Address: string;
  requester: string;
  pda: string;
}

interface PendingDepositsTableProps {
  pendingDeposits: PendingDeposit[];
  onClaim: (requestId: string) => void;
  onSubmitTransaction: (requestId: string) => void;
  isLoading?: boolean;
  isClaimingMap?: Record<string, boolean>;
  isSubmittingMap?: Record<string, boolean>;
}

export function PendingDepositsTable({
  pendingDeposits,
  onClaim,
  onSubmitTransaction,
  isLoading = false,
  isClaimingMap = {},
  isSubmittingMap = {},
}: PendingDepositsTableProps) {
  if (pendingDeposits.length === 0 && !isLoading) {
    return (
      <EmptyState
        icon={Clock}
        title='No pending deposits'
        description='Your pending deposits will appear here once you initiate a deposit.'
      />
    );
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between text-sm'>
        <span className='text-muted-foreground'>
          {pendingDeposits.length} pending deposit
          {pendingDeposits.length > 1 ? 's' : ''} found
        </span>
        <div className='flex items-center space-x-2 text-xs text-orange-600'>
          <AlertTriangle className='h-3 w-3' />
          <span>Processing deposits</span>
        </div>
      </div>
      <div className='border rounded-lg overflow-hidden'>
        <Table>
          <TableHeader>
            <TableRow className='hover:bg-transparent'>
              <TableHead className='font-medium'>Request ID</TableHead>
              <TableHead className='font-medium'>Token Address</TableHead>
              <TableHead className='font-medium'>Amount</TableHead>
              <TableHead className='text-right font-medium'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingDeposits.map(deposit => (
              <TableRow key={deposit.requestId} className='hover:bg-muted/50'>
                <TableCell>
                  <div className='flex items-center space-x-3'>
                    <Badge variant='outline' className='font-mono text-xs'>
                      {formatAddress(deposit.requestId)}
                    </Badge>
                    <CopyButton text={deposit.requestId} />
                  </div>
                </TableCell>
                <TableCell>
                  <div className='flex items-center space-x-3'>
                    <Badge variant='secondary' className='font-mono text-xs'>
                      {formatAddress(deposit.erc20Address)}
                    </Badge>
                    <CopyButton text={deposit.erc20Address} />
                  </div>
                </TableCell>
                <TableCell>
                  <span className='font-mono text-sm font-medium'>
                    {formatTokenAmount(deposit.amount, 6)}
                  </span>
                </TableCell>
                <TableCell className='text-right'>
                  <div className='flex gap-2'>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => onSubmitTransaction(deposit.requestId)}
                      disabled={isLoading || isSubmittingMap[deposit.requestId]}
                    >
                      {isSubmittingMap[deposit.requestId] ? (
                        <>
                          <Send className='h-3 w-3 mr-1' />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className='h-3 w-3 mr-1' />
                          Submit
                        </>
                      )}
                    </Button>
                    <Button
                      size='sm'
                      variant='default'
                      onClick={() => onClaim(deposit.requestId)}
                      disabled={isLoading || isClaimingMap[deposit.requestId]}
                    >
                      {isClaimingMap[deposit.requestId]
                        ? 'Claiming...'
                        : 'Claim'}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
