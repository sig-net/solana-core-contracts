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
      title="Start Your Cross-Chain Journey"
      description="Bridge your ERC20 tokens between Ethereum and Solana seamlessly. Connect your wallet to view balances or start depositing right away."
      action={
        <>
          <div className='flex gap-4 mb-12'>
            <WalletButton />
            <Button 
              onClick={onDepositClick}
              variant="secondary"
              className="gap-2"
            >
              <ArrowDownCircle className="w-4 h-4" />
              Deposit Tokens
            </Button>
          </div>

          <div className='grid grid-cols-2 gap-8 text-center'>
            <div className='flex flex-col items-center gap-3'>
              <div className='flex items-center justify-center w-16 h-16 rounded-full bg-green-100'>
                <ArrowDownCircle className='w-8 h-8 text-green-600' />
              </div>
              <div>
                <p className='text-base font-medium text-dark-neutral-900'>Deposit</p>
                <p className='text-sm text-dark-neutral-600'>From Ethereum</p>
              </div>
            </div>
            
            <div className='flex flex-col items-center gap-3'>
              <div className='flex items-center justify-center w-16 h-16 rounded-full bg-purple-100'>
                <ArrowRightLeft className='w-8 h-8 text-purple-600' />
              </div>
              <div>
                <p className='text-base font-medium text-dark-neutral-900'>Bridge</p>
                <p className='text-sm text-dark-neutral-600'>To Solana</p>
              </div>
            </div>
          </div>
        </>
      }
    />
  );
}