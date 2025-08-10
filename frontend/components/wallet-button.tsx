'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { WalletReadyState } from '@solana/wallet-adapter-base';
import { toast } from 'sonner';
import { Wallet, LogOut } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatAddress } from '@/lib/address-utils';

export function WalletButton() {
  const {
    wallets,
    disconnect,
    connecting,
    disconnecting,
    publicKey,
    connected,
  } = useWallet();
  const { setVisible: setModalVisible } = useWalletModal();

  const installedWallets = wallets.filter(
    w => w.readyState === WalletReadyState.Installed,
  );

  const openWalletModal = () => {
    if (installedWallets.length === 0) {
      toast.info(
        <div>
          No Solana wallet detected. Install{' '}
          <a
            href='https://phantom.app/download'
            target='_blank'
            rel='noreferrer'
            className='underline'
          >
            Phantom
          </a>{' '}
          or{' '}
          <a
            href='https://solflare.com/download'
            target='_blank'
            rel='noreferrer'
            className='underline'
          >
            Solflare
          </a>{' '}
          to continue.
        </div>,
      );
      return;
    }
    setModalVisible(true);
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch {
      toast.error('Failed to disconnect wallet');
    }
  };

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
      <div className='flex items-center gap-2'>
        <Button variant='outline' className='gap-2 font-medium'>
          <Wallet className='h-4 w-4' />
          {formatAddress(publicKey.toString(), 4, 4)}
        </Button>
        <Button
          variant='outline'
          onClick={handleDisconnect}
          disabled={disconnecting}
          className='border-red-200 bg-red-50 font-medium text-red-600'
          title='Disconnect wallet'
        >
          <LogOut className='h-4 w-4' />
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={openWalletModal} className='font-medium'>
      <Wallet className='mr-2 h-4 w-4' />
      Connect Wallet
    </Button>
  );
}
