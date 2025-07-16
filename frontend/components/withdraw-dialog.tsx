import { useState } from 'react';
import { ArrowDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface WithdrawDialogProps {
  erc20Address: string;
  amount: string;
  symbol: string;
  onConfirm: (recipientAddress: string) => void;
  isLoading: boolean;
  children: React.ReactNode;
}

export function WithdrawDialog({
  erc20Address,
  amount,
  symbol,
  onConfirm,
  isLoading,
  children,
}: WithdrawDialogProps) {
  const [recipientAddress, setRecipientAddress] = useState('');
  const [open, setOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (recipientAddress.trim()) {
      onConfirm(recipientAddress.trim());
      setOpen(false);
      setRecipientAddress('');
    }
  };

  const isValidAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  const isValid = recipientAddress.trim() && isValidAddress(recipientAddress);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className='sm:max-w-[425px]'>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <ArrowDown className='h-5 w-5' />
              Withdraw {symbol}
            </DialogTitle>
            <DialogDescription>
              Enter the Ethereum address where you want to receive your tokens.
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='amount'>Amount</Label>
              <Input id='amount' value={amount} disabled className='bg-muted' />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='recipient'>Recipient Address</Label>
              <Input
                id='recipient'
                placeholder='0x...'
                value={recipientAddress}
                onChange={e => setRecipientAddress(e.target.value)}
                className={
                  recipientAddress && !isValidAddress(recipientAddress)
                    ? 'border-destructive focus:border-destructive'
                    : ''
                }
              />
              {recipientAddress && !isValidAddress(recipientAddress) && (
                <p className='text-sm text-destructive'>
                  Please enter a valid Ethereum address
                </p>
              )}
            </div>
            <div className='p-3 bg-muted/50 rounded-lg space-y-2'>
              <h4 className='text-sm font-medium'>Transaction Details</h4>
              <div className='text-xs text-muted-foreground space-y-1'>
                <div className='flex justify-between'>
                  <span>Token:</span>
                  <span className='font-mono'>{symbol}</span>
                </div>
                <div className='flex justify-between'>
                  <span>Contract:</span>
                  <span className='font-mono text-xs'>
                    {erc20Address.slice(0, 6)}...{erc20Address.slice(-4)}
                  </span>
                </div>
                <div className='flex justify-between'>
                  <span>Network:</span>
                  <span>Ethereum Sepolia</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={!isValid || isLoading}>
              {isLoading ? 'Processing...' : 'Withdraw'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
