import { Wallet } from 'lucide-react';

import { WalletButton } from '@/components/wallet-button';

export function AppHeader() {
  return (
    <header className='border-b sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
      <div className='container mx-auto px-4 py-4'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center space-x-3'>
            <div className='flex items-center justify-center w-8 h-8 bg-primary rounded-lg'>
              <Wallet className='h-4 w-4 text-primary-foreground' />
            </div>
            <div>
              <h1 className='text-lg font-semibold'>Solana dApp</h1>
              <p className='text-xs text-muted-foreground'>
                ERC20 Token Manager
              </p>
            </div>
          </div>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
