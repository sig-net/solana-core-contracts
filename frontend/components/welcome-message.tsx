import { PublicKey } from '@solana/web3.js';

import { formatAddress } from '@/lib/address-utils';

interface WelcomeMessageProps {
  publicKey: PublicKey;
}

export function WelcomeMessage({ publicKey }: WelcomeMessageProps) {
  return (
    <div className='text-center py-6'>
      <h2 className='text-xl font-semibold mb-2'>Welcome back!</h2>
      <p className='text-muted-foreground'>
        Wallet connected: {formatAddress(publicKey.toString())}
      </p>
    </div>
  );
}
