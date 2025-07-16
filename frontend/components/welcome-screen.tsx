import { Wallet, ArrowUpCircle, RefreshCw, ExternalLink } from 'lucide-react';

import { WalletButton } from '@/components/wallet-button';
import { FeatureCard } from '@/components/ui/feature-card';

const features = [
  {
    icon: ArrowUpCircle,
    title: 'Derive Address',
    description: 'Get your unique deposit address',
    iconColor: 'text-green-600 dark:text-green-400',
    iconBgColor: 'bg-green-100 dark:bg-green-900/20',
  },
  {
    icon: RefreshCw,
    title: 'View Balances',
    description: 'Check your token balances',
    iconColor: 'text-blue-600 dark:text-blue-400',
    iconBgColor: 'bg-blue-100 dark:bg-blue-900/20',
  },
  {
    icon: ExternalLink,
    title: 'Withdraw',
    description: 'Transfer tokens safely',
    iconColor: 'text-purple-600 dark:text-purple-400',
    iconBgColor: 'bg-purple-100 dark:bg-purple-900/20',
  },
];

export function WelcomeScreen() {
  return (
    <div className='flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8'>
      <div className='space-y-4 flex flex-col items-center justify-center'>
        <div className='flex items-center justify-center w-16 h-16 bg-muted rounded-full'>
          <Wallet className='h-8 w-8 text-muted-foreground' />
        </div>
        <div className='space-y-2'>
          <h2 className='text-2xl font-semibold'>Welcome to Solana dApp</h2>
          <p className='text-muted-foreground max-w-md'>
            Connect your wallet to manage your ERC20 tokens, view balances, and
            perform withdrawals.
          </p>
        </div>
      </div>

      <WalletButton />

      <div className='grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl'>
        {features.map(feature => (
          <FeatureCard key={feature.title} {...feature} />
        ))}
      </div>
    </div>
  );
}
