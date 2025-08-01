'use client';

import { useWalletMultiButton } from '@solana/wallet-adapter-base-ui';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Wallet, ChevronDown, LogOut, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatAddress } from '@/lib/address-utils';

export function WalletButton() {
  const { setVisible: setModalVisible } = useWalletModal();
  const { buttonState, onConnect, onDisconnect, publicKey } = useWalletMultiButton({
    onSelectWallet() {
      setModalVisible(true);
    },
  });

  const handleClick = () => {
    switch (buttonState) {
      case 'no-wallet':
        setModalVisible(true);
        break;
      case 'has-wallet':
        // has-wallet state is handled by dropdown
        break;
      case 'connected':
        // Connected state is handled by dropdown
        break;
    }
  };

  if (buttonState === 'connecting') {
    return (
      <Button disabled>
        <Wallet className='mr-2 h-4 w-4' />
        Connecting...
      </Button>
    );
  }

  if (buttonState === 'connected' && publicKey) {
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
          <DropdownMenuItem onClick={() => setModalVisible(true)}>
            <RefreshCw className='mr-2 h-4 w-4' />
            Change Wallet
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDisconnect} className='text-red-500'>
            <LogOut className='mr-2 h-4 w-4' />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // For has-wallet state, show dropdown with connect and disconnect options
  if (buttonState === 'has-wallet') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className='gap-2 font-medium'>
            <Wallet className='h-4 w-4' />
            Connect
            <ChevronDown className='h-3 w-3' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuItem onClick={onConnect}>
            <Wallet className='mr-2 h-4 w-4' />
            Connect
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDisconnect} className='text-red-500'>
            <LogOut className='mr-2 h-4 w-4' />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button onClick={handleClick} className='font-medium'>
      <Wallet className='mr-2 h-4 w-4' />
      Connect Wallet
    </Button>
  );
}
