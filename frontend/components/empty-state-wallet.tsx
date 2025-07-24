import { Wallet, ArrowDownCircle, ArrowRightLeft } from 'lucide-react';

import { WalletButton } from '@/components/wallet-button';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

interface EmptyStateWalletProps {
  onDepositClick: () => void;
}

export function EmptyStateWallet({ onDepositClick }: EmptyStateWalletProps) {
  return (
    <EmptyState
      icon={Wallet}
      title='Start Your Cross-Chain Journey'
      description='Bridge your ERC20 tokens between Ethereum and Solana seamlessly. Connect your wallet to view balances or start depositing right away.'
      action={
        <>
          <div className='mb-12 flex gap-4'>
            <WalletButton />
            <Button
              onClick={onDepositClick}
              variant='secondary'
              className='gap-2'
            >
              <ArrowDownCircle className='h-4 w-4' />
              Deposit Tokens
            </Button>
          </div>

          <div className='grid grid-cols-2 gap-8 text-center'>
            <div className='flex flex-col items-center gap-3'>
              <div className='flex h-16 w-16 items-center justify-center rounded-full bg-green-100'>
                <ArrowDownCircle className='h-8 w-8 text-green-600' />
              </div>
              <div>
                <p className='text-dark-neutral-900 text-base font-medium'>
                  Deposit
                </p>
                <p className='text-dark-neutral-600 text-sm'>From Ethereum</p>
              </div>
            </div>

            <div className='flex flex-col items-center gap-3'>
              <div className='flex h-16 w-16 items-center justify-center rounded-full bg-purple-100'>
                <ArrowRightLeft className='h-8 w-8 text-purple-600' />
              </div>
              <div>
                <p className='text-dark-neutral-900 text-base font-medium'>
                  Bridge
                </p>
                <p className='text-dark-neutral-600 text-sm'>To Solana</p>
              </div>
            </div>
          </div>
        </>
      }
    />
  );
}
