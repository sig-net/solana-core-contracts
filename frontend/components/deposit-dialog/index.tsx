'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TokenMetadata, NetworkData } from '@/lib/constants/token-metadata';
import { useDepositAddress } from '@/hooks';
import { useDepositErc20Mutation } from '@/hooks/use-deposit-erc20-mutation';

import { TokenSelection } from './token-selection';
import { DepositAddress } from './deposit-address';
import { LoadingState } from './loading-state';

interface DepositDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

enum DepositStep {
  SELECT_TOKEN = 'select-token',
  GENERATING_ADDRESS = 'generating-address',
  SHOW_ADDRESS = 'show-address',
}

export function DepositDialog({ open, onOpenChange }: DepositDialogProps) {
  const { publicKey } = useWallet();
  const [step, setStep] = useState<DepositStep>(DepositStep.SELECT_TOKEN);
  const [selectedToken, setSelectedToken] = useState<TokenMetadata | null>(
    null,
  );
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkData | null>(
    null,
  );

  const { data: depositAddress, isLoading: isGeneratingAddress } =
    useDepositAddress();
  const depositMutation = useDepositErc20Mutation();

  const handleTokenSelect = (token: TokenMetadata, network: NetworkData) => {
    setSelectedToken(token);
    setSelectedNetwork(network);
    setStep(DepositStep.GENERATING_ADDRESS);
  };

  const handleNotifyRelayer = async () => {
    if (!publicKey || !selectedToken || !selectedNetwork) return;

    try {
      // Notify relayer and close dialog - processing happens in background
      await depositMutation.mutateAsync({
        erc20Address: selectedToken.address,
        amount: '', // Empty amount since user determines actual amount sent
        decimals: selectedToken.decimals,
      });

      // Close dialog immediately after notification
      handleClose();
    } catch (err) {
      console.error('Failed to notify relayer:', err);
      // Still close dialog - user can check activity table later
      handleClose();
    }
  };

  const handleClose = () => {
    setStep(DepositStep.SELECT_TOKEN);
    setSelectedToken(null);
    setSelectedNetwork(null);
    onOpenChange(false);
  };

  useEffect(() => {
    if (
      step === DepositStep.GENERATING_ADDRESS &&
      depositAddress &&
      !isGeneratingAddress
    ) {
      setStep(DepositStep.SHOW_ADDRESS);
    }
  }, [step, depositAddress, isGeneratingAddress]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='gradient-popover max-w-md rounded-sm p-10 shadow-[0px_4px_9.3px_0px_rgba(41,86,70,0.35)]'>
        {step === DepositStep.SELECT_TOKEN && (
          <div className='space-y-5'>
            <DialogHeader className='space-y-0 p-0'>
              <DialogTitle className='text-dark-neutral-400 text-xl font-semibold'>
                Select an asset
              </DialogTitle>
            </DialogHeader>
            <TokenSelection onTokenSelect={handleTokenSelect} />
          </div>
        )}

        {step === DepositStep.GENERATING_ADDRESS && selectedToken && (
          <LoadingState token={selectedToken} />
        )}

        {step === DepositStep.SHOW_ADDRESS &&
          selectedToken &&
          selectedNetwork &&
          depositAddress && (
            <div className='space-y-5'>
              <DialogHeader className='space-y-0 p-0'>
                <DialogTitle className='text-dark-neutral-400 text-xl font-semibold'>
                  Deposit Address
                </DialogTitle>
              </DialogHeader>
              <DepositAddress
                token={selectedToken}
                network={selectedNetwork}
                depositAddress={depositAddress}
                onContinue={handleNotifyRelayer}
              />
              <p className='text-dark-neutral-300 text-xs'>
                Network: {selectedNetwork.chainName}
              </p>
            </div>
          )}
      </DialogContent>
    </Dialog>
  );
}
