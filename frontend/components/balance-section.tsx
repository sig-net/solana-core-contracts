'use client';

import { useState } from 'react';
import { Package } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { BalanceDisplay } from '@/components/balance-display';
import { EmptyState, LoadingState, ErrorState } from '@/components/states';
import { DepositDialog } from '@/components/deposit-dialog';
import { useUserBalances } from '@/hooks';
import { convertTokenBalancesToDisplayTokens } from '@/lib/utils';

export function BalanceSection() {
  const { data: userBalances = [], isLoading, error } = useUserBalances();
  const [isDepositDialogOpen, setIsDepositDialogOpen] = useState(false);

  const handleDepositClick = () => {
    setIsDepositDialogOpen(true);
  };

  const displayTokens = convertTokenBalancesToDisplayTokens(userBalances);

  if (isLoading) {
    return <LoadingState message='Loading balances...' />;
  }

  if (error) {
    return <ErrorState error={error} title='Error loading balances' compact />;
  }

  if (displayTokens.length === 0) {
    return (
      <>
        <EmptyState
          icon={Package}
          title='No tokens found'
          description='Deposit some tokens to get started with the bridge.'
          compact
          action={
            <Button onClick={handleDepositClick} variant='default'>
              Deposit Tokens
            </Button>
          }
        />
        <DepositDialog
          open={isDepositDialogOpen}
          onOpenChange={setIsDepositDialogOpen}
        />
      </>
    );
  }

  return (
    <>
      <BalanceDisplay tokens={displayTokens} />
      <DepositDialog
        open={isDepositDialogOpen}
        onOpenChange={setIsDepositDialogOpen}
      />
    </>
  );
}
