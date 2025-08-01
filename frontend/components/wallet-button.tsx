'use client';

import { useWalletMultiButton } from '@solana/wallet-adapter-base-ui';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { Wallet, LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatAddress } from '@/lib/address-utils';

export function WalletButton() {
  const { setVisible: setModalVisible } = useWalletModal();
  const { buttonState, onConnect, onSelectWallet, onDisconnect, publicKey } =
    useWalletMultiButton({
      onSelectWallet() {
        setModalVisible(true);
      },
    });

  if (buttonState === 'connecting') {
    return (
      <Button disabled>
        <Wallet className='mr-2 h-4 w-4' />
        Connecting...
      </Button>
    );
  }

  if (buttonState === 'has-wallet' || buttonState === 'connected') {
    return (
      <div className='flex items-center gap-2'>
        {buttonState === 'connected' && publicKey && (
          <Button variant='outline' className='gap-2 font-medium'>
            <Wallet className='h-4 w-4' />
            {formatAddress(publicKey.toString(), 4, 4)}
          </Button>
        )}
        {buttonState === 'has-wallet' && !publicKey && (
          <Button onClick={onConnect} className='gap-2 font-medium'>
            <Wallet className='h-4 w-4' />
            Connect
          </Button>
        )}
        <Button
          variant='outline'
          onClick={onDisconnect}
          className='border-red-200 bg-red-50 font-medium text-red-600'
          title='Disconnect wallet'
        >
          <LogOut className='h-4 w-4' />
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={onSelectWallet} className='font-medium'>
      <Wallet className='mr-2 h-4 w-4' />
      Select Wallet
    </Button>
  );
}
