'use client';

import { AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { AddressDisplay } from '@/components/ui/address-display';
import { WithdrawDialog } from '@/components/withdraw-dialog';
import { formatTokenAmount } from '@/lib/program/utils';
import { getTokenMetadata } from '@/lib/constants/token-metadata';
import type { TokenBalance } from '@/lib/types/token.types';

interface BalanceTableProps {
  balances: TokenBalance[];
  onWithdraw: (
    address: string,
    amount: string,
    recipientAddress: string,
  ) => void;
  isLoading?: boolean;
}

export function BalanceTable({
  balances,
  onWithdraw,
  isLoading = false,
}: BalanceTableProps) {
  if (balances.length === 0 && !isLoading) {
    return (
      <EmptyState
        icon={AlertCircle}
        title='No tokens found'
        description='Make a deposit to your address above to see token balances here.'
      />
    );
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between text-sm'>
        <span className='text-muted-foreground'>
          {balances.length} token{balances.length > 1 ? 's' : ''} found
        </span>
      </div>
      <div className='border rounded-lg overflow-hidden'>
        <Table>
          <TableHeader>
            <TableRow className='hover:bg-transparent'>
              <TableHead className='font-medium'>Token Address</TableHead>
              <TableHead className='font-medium'>Amount</TableHead>
              <TableHead className='text-right font-medium'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {balances.map(balance => (
              <TableRow
                key={balance.erc20Address}
                className='hover:bg-muted/50'
              >
                <TableCell>
                  <AddressDisplay address={balance.erc20Address} />
                </TableCell>
                <TableCell>
                  <span className='font-mono text-sm font-medium'>
                    {formatTokenAmount(
                      balance.amount,
                      balance.decimals,
                    )}
                  </span>
                </TableCell>
                <TableCell className='text-right'>
                  <WithdrawDialog
                    erc20Address={balance.erc20Address}
                    amount={formatTokenAmount(
                      balance.amount,
                      balance.decimals,
                    )}
                    symbol={getTokenMetadata(balance.erc20Address)?.symbol || 'ERC20'}
                    onConfirm={recipientAddress =>
                      onWithdraw(
                        balance.erc20Address,
                        balance.amount,
                        recipientAddress,
                      )
                    }
                    isLoading={isLoading}
                  >
                    <Button
                      size='sm'
                      variant='destructive'
                      disabled={isLoading}
                    >
                      Withdraw
                    </Button>
                  </WithdrawDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
