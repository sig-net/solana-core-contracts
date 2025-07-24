'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Wallet, ChevronDown, LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatAddress } from '@/lib/address-utils';

export function WalletButton() {
  const { publicKey, disconnect, connecting, connected } = useWallet();
  const { setVisible } = useWalletModal();

  if (connecting) {
    return (
      <Button disabled>
        <Wallet className='mr-2 h-4 w-4' />
        Connecting...
      </Button>
    );
  }

  if (connected && publicKey) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='outline' className='gap-2 font-medium'>
            <Wallet className='h-4 w-4' />
            {formatAddress(publicKey.toString(), 4, 4)}
            <ChevronDown className='h-3 w-3' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuItem onClick={disconnect} className='text-red-500'>
            <LogOut className='mr-2 h-4 w-4' />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button onClick={() => setVisible(true)} className='font-medium'>
      <Wallet className='mr-2 h-4 w-4' />
      Connect Wallet
    </Button>
  );
}
