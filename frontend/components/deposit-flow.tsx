'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { ArrowRight, Check, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CopyButton } from '@/components/ui/copy-button';
import { useDepositErc20Mutation, useClaimErc20Mutation } from '@/hooks';
import { deriveUserEthereumAddress } from '@/lib/program/utils';
import { SUPPORTED_TOKENS } from '@/lib/constants/token-metadata';

const SEPOLIA_TOKENS = SUPPORTED_TOKENS;

const VAULT_ADDRESS = '0x041477de8ecbcf633cb13ea10aa86cdf4d437c29';

type DepositStep = 'select' | 'deposit' | 'initiate' | 'claim' | 'complete';

interface DepositFlowProps {
  onRefreshBalances: () => void;
}

export function DepositFlow({ onRefreshBalances }: DepositFlowProps) {
  const { publicKey } = useWallet();
  const [currentStep, setCurrentStep] = useState<DepositStep>('select');
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [requestId, setRequestId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [depositStatus, setDepositStatus] = useState<{
    status: string;
    txHash?: string;
    note?: string;
    error?: string;
  } | null>(null);
  const [_isRetrying, setIsRetrying] = useState(false);

  const depositMutation = useDepositErc20Mutation();
  const claimMutation = useClaimErc20Mutation();

  const steps = [
    {
      id: 'select',
      title: 'Select Token & Amount',
      description: 'Choose which token to bridge',
    },
    {
      id: 'deposit',
      title: 'Fund Derived Account',
      description: 'Send ERC20 tokens to your derived Ethereum address',
    },
    {
      id: 'initiate',
      title: 'Initiate Bridge',
      description: 'Transfer tokens from derived account to vault',
    },
    {
      id: 'claim',
      title: 'Claim Tokens',
      description: 'Credit bridged tokens to your Solana balance',
    },
    {
      id: 'complete',
      title: 'Complete',
      description: 'Tokens bridged successfully',
    },
  ];

  const getStepStatus = (stepId: string) => {
    const currentIndex = steps.findIndex(s => s.id === currentStep);
    const stepIndex = steps.findIndex(s => s.id === stepId);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'pending';
  };

  const handleTokenSelect = () => {
    if (!selectedToken || !amount) {
      setError('Please select a token and enter an amount');
      return;
    }
    setError('');
    setCurrentStep('deposit');
  };

  const handleDepositComplete = () => {
    setError('');
    setCurrentStep('initiate');
  };

  const handleInitiateBridge = async () => {
    if (!publicKey || !selectedToken || !amount) return;

    setError('');

    try {
      const requestIdResult = await depositMutation.mutateAsync({
        erc20Address: selectedToken,
        amount: amount,
        decimals: selectedTokenInfo?.decimals || 6,
        onStatusChange: setDepositStatus,
      });

      setRequestId(requestIdResult);
      setCurrentStep('claim');
    } catch (err) {
      console.error('Failed to initiate bridge:', err);
      const friendlyError = getErrorMessage(err);
      setError(friendlyError);
      toast.error(friendlyError);
    }
  };

  const handleClaimTokens = async () => {
    if (!publicKey || !requestId) return;

    // If already completed, just transition to the complete step
    if (depositStatus?.status === 'completed') {
      setCurrentStep('complete');
      onRefreshBalances();
      toast.success('Tokens claimed successfully!');
      return;
    }

    setError('');

    try {
      await claimMutation.mutateAsync({
        requestId: requestId,
      });

      setCurrentStep('complete');
      onRefreshBalances();
      toast.success('Tokens claimed successfully!');
    } catch (err) {
      console.error('Failed to claim tokens:', err);
      const friendlyError = getErrorMessage(err);
      setError(friendlyError);
      toast.error(friendlyError);
    }
  };

  const resetFlow = () => {
    setCurrentStep('select');
    setSelectedToken('');
    setAmount('');
    setRequestId('');
    setError('');
    setDepositStatus(null);
    setIsRetrying(false);
  };

  const restartFromInitiate = () => {
    setCurrentStep('initiate');
    setError('');
    setDepositStatus(null);
    setIsRetrying(false);
  };

  const restartFromClaim = () => {
    setCurrentStep('claim');
    setError('');
    setIsRetrying(false);
  };

  const getErrorMessage = (error: unknown): string => {
    if (!error) return '';

    const errorMessage = error instanceof Error ? error.message : String(error);

    // Provide more user-friendly error messages
    if (errorMessage.includes('already been processed')) {
      return 'This transaction has already been processed. Please check your balances or start a new deposit.';
    }

    if (errorMessage.includes('pending deposit already exists')) {
      return 'A deposit is already in progress. Please wait for it to complete or try again later.';
    }

    if (errorMessage.includes('insufficient funds')) {
      return 'Insufficient funds in your derived address. Please send tokens to your derived address first.';
    }

    if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      return 'Network error occurred. Please check your connection and try again.';
    }

    if (errorMessage.includes('signature')) {
      return 'Signature process failed. This may be due to network issues. Please try again.';
    }

    if (errorMessage.includes('claim')) {
      return 'Failed to claim tokens. The transaction may have already been processed. Please check your balances.';
    }

    // Return original error if no specific handling
    return errorMessage;
  };

  const selectedTokenInfo = SEPOLIA_TOKENS.find(
    t => t.address === selectedToken,
  );

  // Auto-transition to complete step when status is completed
  useEffect(() => {
    if (depositStatus?.status === 'completed' && currentStep === 'claim') {
      const timer = setTimeout(() => {
        setCurrentStep('complete');
        onRefreshBalances();
        toast.success('Tokens claimed successfully!');
      }, 1500); // Wait 1.5 seconds to show the completed state briefly

      return () => clearTimeout(timer);
    }
  }, [depositStatus?.status, currentStep, onRefreshBalances]);

  return (
    <Card className='w-full max-w-2xl mx-auto'>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <div className='w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center'>
              <ArrowRight className='h-4 w-4 text-blue-600 dark:text-blue-400' />
            </div>
            <CardTitle>Bridge ERC20 Tokens</CardTitle>
          </div>
          {currentStep !== 'select' && (
            <Button
              variant='ghost'
              size='sm'
              onClick={resetFlow}
              className='text-gray-500 hover:text-gray-700'
            >
              Reset
            </Button>
          )}
        </div>
        <CardDescription>
          Bridge your Sepolia testnet tokens to Solana
        </CardDescription>
      </CardHeader>

      <CardContent className='space-y-6'>
        {/* Progress Steps */}
        <div className='flex items-center justify-between'>
          {steps.map((step, index) => (
            <div key={step.id} className='flex items-center'>
              <div
                className={`
                flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-medium
                ${
                  getStepStatus(step.id) === 'completed'
                    ? 'bg-green-500 border-green-500 text-white'
                    : getStepStatus(step.id) === 'current'
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'border-gray-300 text-gray-500'
                }
              `}
              >
                {getStepStatus(step.id) === 'completed' ? (
                  <Check className='w-4 h-4' />
                ) : (
                  index + 1
                )}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-12 h-0.5 mx-2 ${
                    getStepStatus(step.id) === 'completed'
                      ? 'bg-green-500'
                      : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className='min-h-[300px]'>
          {/* Step 1: Select Token */}
          {currentStep === 'select' && (
            <div className='space-y-4'>
              <div className='text-center py-4'>
                <h3 className='text-lg font-semibold mb-2'>
                  Select Token & Amount
                </h3>
                <p className='text-muted-foreground'>
                  Choose which token you want to bridge to Solana
                </p>
              </div>

              <div className='space-y-4'>
                <div>
                  <Label htmlFor='token'>Token</Label>
                  <Select
                    value={selectedToken}
                    onValueChange={setSelectedToken}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Select a token' />
                    </SelectTrigger>
                    <SelectContent>
                      {SEPOLIA_TOKENS.map(token => (
                        <SelectItem key={token.address} value={token.address}>
                          <div className='flex items-center gap-2'>
                            <Badge variant='secondary'>{token.symbol}</Badge>
                            <span>{token.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor='amount'>Amount</Label>
                  <Input
                    id='amount'
                    type='number'
                    placeholder='Enter amount'
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                  />
                </div>

                {error && (
                  <div className='flex items-center gap-2 text-red-500 text-sm'>
                    <AlertCircle className='w-4 h-4' />
                    {error}
                  </div>
                )}

                <Button
                  onClick={handleTokenSelect}
                  className='w-full'
                  disabled={!selectedToken || !amount}
                >
                  Continue
                  <ArrowRight className='w-4 h-4 ml-2' />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Fund Derived Account */}
          {currentStep === 'deposit' && (
            <div className='space-y-4'>
              <div className='text-center py-4'>
                <h3 className='text-lg font-semibold mb-2'>
                  Fund Your Derived Account
                </h3>
                <p className='text-muted-foreground'>
                  Send ERC20 tokens to your derived Ethereum address
                </p>
              </div>

              <div className='bg-muted/30 rounded-lg p-4 space-y-3'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm font-medium'>Token:</span>
                  <Badge variant='secondary'>{selectedTokenInfo?.symbol}</Badge>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-sm font-medium'>Amount:</span>
                  <span className='text-sm'>{amount}</span>
                </div>
                <div className='flex items-center justify-between'>
                  <span className='text-sm font-medium'>Token Address:</span>
                  <div className='flex items-center gap-2'>
                    <code className='text-xs bg-muted px-2 py-1 rounded'>
                      {selectedToken?.slice(0, 6)}...{selectedToken?.slice(-4)}
                    </code>
                    <CopyButton text={selectedToken} size='sm' />
                  </div>
                </div>
              </div>

              <div className='bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4'>
                <div className='flex items-center gap-2 mb-2'>
                  <AlertCircle className='w-4 h-4 text-blue-600' />
                  <span className='text-sm font-medium'>
                    Your Derived Ethereum Address
                  </span>
                </div>
                <div className='flex items-center gap-2 p-3 bg-white dark:bg-gray-800 rounded border'>
                  <code className='flex-1 text-sm font-mono break-all'>
                    {publicKey
                      ? deriveUserEthereumAddress(publicKey)
                      : 'Connect wallet first'}
                  </code>
                  {publicKey && (
                    <CopyButton
                      text={deriveUserEthereumAddress(publicKey)}
                      size='sm'
                    />
                  )}
                </div>
                <p className='text-xs text-muted-foreground mt-2'>
                  This address is derived from your Solana public key and
                  controlled by the MPC system.
                </p>
              </div>

              {error && (
                <div className='flex items-center gap-2 text-red-500 text-sm'>
                  <AlertCircle className='w-4 h-4' />
                  {error}
                </div>
              )}

              <div className='flex gap-2'>
                <Button
                  variant='outline'
                  onClick={() => setCurrentStep('select')}
                  className='flex-1'
                >
                  Back
                </Button>
                <Button onClick={handleDepositComplete} className='flex-1'>
                  I&apos;ve sent the tokens
                  <ArrowRight className='w-4 h-4 ml-2' />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Initiate Bridge */}
          {currentStep === 'initiate' && (
            <div className='space-y-4'>
              <div className='text-center py-4'>
                <h3 className='text-lg font-semibold mb-2'>Initiate Bridge</h3>
                <p className='text-muted-foreground'>
                  Move tokens from your derived account to the vault
                </p>
              </div>

              <div className='bg-muted/30 rounded-lg p-4'>
                <div className='flex items-center gap-2 mb-3'>
                  <Clock className='w-4 h-4 text-blue-500' />
                  <span className='text-sm font-medium'>
                    Bridge Transaction
                  </span>
                </div>
                <div className='space-y-2 text-sm'>
                  <div className='flex justify-between'>
                    <span>From:</span>
                    <code className='text-xs bg-muted px-2 py-1 rounded'>
                      {publicKey
                        ? `${deriveUserEthereumAddress(publicKey).slice(0, 6)}...${deriveUserEthereumAddress(publicKey).slice(-4)}`
                        : 'N/A'}
                    </code>
                  </div>
                  <div className='flex justify-between'>
                    <span>To:</span>
                    <code className='text-xs bg-muted px-2 py-1 rounded'>
                      {VAULT_ADDRESS.slice(0, 6)}...{VAULT_ADDRESS.slice(-4)}
                    </code>
                  </div>
                </div>
              </div>

              <div className='bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4'>
                <div className='flex items-center gap-2 mb-2'>
                  <AlertCircle className='w-4 h-4 text-yellow-600' />
                  <span className='text-sm font-medium'>
                    What happens next?
                  </span>
                </div>
                <p className='text-sm text-muted-foreground'>
                  The deposit_erc20 function will create an Ethereum transaction
                  to transfer your tokens from your derived account to the vault
                  address. This transaction will be signed by the MPC system.
                </p>
              </div>

              {error && (
                <div className='bg-red-50 dark:bg-red-900/20 rounded-lg p-4'>
                  <div className='flex items-center gap-2 text-red-500 text-sm mb-2'>
                    <AlertCircle className='w-4 h-4' />
                    <span className='font-medium'>Error</span>
                  </div>
                  <p className='text-red-700 dark:text-red-300 text-sm mb-3'>
                    {error}
                  </p>
                  <div className='flex gap-2'>
                    <Button
                      onClick={restartFromInitiate}
                      size='sm'
                      variant='outline'
                      className='border-red-300 text-red-700 hover:bg-red-50'
                    >
                      Try Again
                    </Button>
                    <Button
                      onClick={() => setCurrentStep('deposit')}
                      size='sm'
                      variant='outline'
                      className='border-red-300 text-red-700 hover:bg-red-50'
                    >
                      Back to Deposit
                    </Button>
                    <Button
                      onClick={resetFlow}
                      size='sm'
                      variant='outline'
                      className='border-red-300 text-red-700 hover:bg-red-50'
                    >
                      Start Over
                    </Button>
                  </div>
                </div>
              )}

              <div className='flex gap-2'>
                <Button
                  variant='outline'
                  onClick={() => setCurrentStep('deposit')}
                  className='flex-1'
                  disabled={depositMutation.isPending || !!error}
                >
                  Back
                </Button>
                <Button
                  onClick={handleInitiateBridge}
                  className='flex-1'
                  disabled={depositMutation.isPending || !!error}
                >
                  {depositMutation.isPending ? (
                    <>
                      <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                      Initiating...
                    </>
                  ) : (
                    <>
                      Call deposit_erc20
                      <ArrowRight className='w-4 h-4 ml-2' />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Claim Tokens */}
          {currentStep === 'claim' && (
            <div className='space-y-4'>
              <div className='text-center py-4'>
                <h3 className='text-lg font-semibold mb-2'>
                  Claim Your Tokens
                </h3>
                <p className='text-muted-foreground'>
                  Credit the bridged tokens to your Solana balance
                </p>
              </div>

              <div className='bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4'>
                <div className='flex items-center gap-2 mb-2'>
                  <Clock className='w-4 h-4 text-blue-600' />
                  <span className='text-sm font-medium'>
                    Processing Ethereum Transaction
                  </span>
                </div>
                <p className='text-sm text-muted-foreground mb-3'>
                  The MPC system is signing and submitting your transaction to
                  Ethereum. This typically takes 1-2 minutes.
                </p>
                <div className='space-y-2'>
                  <div className='flex items-center gap-2'>
                    <div
                      className={`w-4 h-4 rounded-full ${
                        depositStatus?.status === 'waiting_signature' ||
                        depositStatus?.status === 'submitting_ethereum' ||
                        depositStatus?.status === 'confirming_ethereum' ||
                        depositStatus?.status === 'waiting_read_response' ||
                        depositStatus?.status === 'ready_to_claim' ||
                        depositStatus?.status === 'completed'
                          ? 'bg-green-500'
                          : 'bg-gray-300 animate-pulse'
                      }`}
                    ></div>
                    <span className='text-sm'>
                      {depositStatus?.status === 'waiting_signature' ||
                      depositStatus?.status === 'submitting_ethereum' ||
                      depositStatus?.status === 'confirming_ethereum' ||
                      depositStatus?.status === 'waiting_read_response' ||
                      depositStatus?.status === 'ready_to_claim' ||
                      depositStatus?.status === 'completed'
                        ? 'Transaction signed by MPC'
                        : 'Waiting for MPC signature...'}
                    </span>
                  </div>
                  <div className='flex items-center gap-2'>
                    <div
                      className={`w-4 h-4 rounded-full ${
                        depositStatus?.status === 'confirming_ethereum' ||
                        depositStatus?.status === 'waiting_read_response' ||
                        depositStatus?.status === 'ready_to_claim' ||
                        depositStatus?.status === 'completed'
                          ? 'bg-green-500'
                          : depositStatus?.status === 'submitting_ethereum'
                            ? 'bg-blue-500 animate-pulse'
                            : 'bg-gray-300'
                      }`}
                    ></div>
                    <span className='text-sm'>
                      {depositStatus?.status === 'confirming_ethereum' ||
                      depositStatus?.status === 'waiting_read_response' ||
                      depositStatus?.status === 'ready_to_claim' ||
                      depositStatus?.status === 'completed'
                        ? 'Ethereum transaction confirmed!'
                        : depositStatus?.status === 'submitting_ethereum'
                          ? 'Submitting to Ethereum...'
                          : 'Waiting for Ethereum submission...'}
                    </span>
                  </div>
                  <div className='flex items-center gap-2'>
                    <div
                      className={`w-4 h-4 rounded-full ${
                        depositStatus?.status === 'completed'
                          ? 'bg-green-500'
                          : depositStatus?.status === 'auto_claiming'
                            ? 'bg-blue-500 animate-pulse'
                            : depositStatus?.status === 'ready_to_claim'
                              ? 'bg-green-500'
                              : depositStatus?.status ===
                                  'waiting_read_response'
                                ? 'bg-blue-500 animate-pulse'
                                : 'bg-gray-300'
                      }`}
                    ></div>
                    <span className='text-sm'>
                      {depositStatus?.status === 'completed'
                        ? 'Tokens claimed successfully!'
                        : depositStatus?.status === 'auto_claiming'
                          ? 'Auto-claiming tokens...'
                          : depositStatus?.status === 'ready_to_claim'
                            ? 'Ready to claim!'
                            : depositStatus?.status === 'waiting_read_response'
                              ? 'Waiting for read response...'
                              : 'Waiting for transaction result...'}
                    </span>
                  </div>
                  {depositStatus?.txHash && (
                    <div className='mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs'>
                      <span className='font-medium'>TX Hash: </span>
                      <code className='break-all'>{depositStatus.txHash}</code>
                    </div>
                  )}
                </div>
              </div>

              {depositStatus?.status === 'auto_claiming' && (
                <div className='bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4'>
                  <div className='flex items-center gap-2 text-blue-600 text-sm mb-2'>
                    <Loader2 className='w-4 h-4 animate-spin' />
                    <span className='font-medium'>Auto-claiming Tokens...</span>
                  </div>
                  <p className='text-blue-700 dark:text-blue-300 text-sm'>
                    Your tokens are being automatically claimed. This process
                    usually takes a few seconds.
                  </p>
                </div>
              )}

              {depositStatus?.status === 'completed' && (
                <div className='bg-green-50 dark:bg-green-900/20 rounded-lg p-4'>
                  <div className='flex items-center gap-2 text-green-600 text-sm mb-2'>
                    <Check className='w-4 h-4' />
                    <span className='font-medium'>
                      Tokens Claimed Successfully!
                    </span>
                  </div>
                  <p className='text-green-700 dark:text-green-300 text-sm'>
                    Your tokens have been automatically claimed and will be
                    available in your balance shortly. You&apos;ll be redirected
                    to the completion page in a moment.
                  </p>
                </div>
              )}

              {depositStatus?.status === 'ready_to_claim' && (
                <div className='bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4'>
                  <div className='flex items-center gap-2 text-blue-600 text-sm mb-2'>
                    <Clock className='w-4 h-4' />
                    <span className='font-medium'>Ready to Claim</span>
                  </div>
                  <p className='text-blue-700 dark:text-blue-300 text-sm'>
                    Your transaction is confirmed and tokens are ready to be
                    claimed. The claiming process will start automatically, or
                    you can click the button below to claim manually.
                  </p>
                </div>
              )}

              {error && (
                <div className='bg-red-50 dark:bg-red-900/20 rounded-lg p-4'>
                  <div className='flex items-center gap-2 text-red-500 text-sm mb-2'>
                    <AlertCircle className='w-4 h-4' />
                    <span className='font-medium'>Error</span>
                  </div>
                  <p className='text-red-700 dark:text-red-300 text-sm mb-3'>
                    {error}
                  </p>
                  <div className='flex gap-2'>
                    <Button
                      onClick={restartFromClaim}
                      size='sm'
                      variant='outline'
                      className='border-red-300 text-red-700 hover:bg-red-50'
                    >
                      Try Again
                    </Button>
                    <Button
                      onClick={restartFromInitiate}
                      size='sm'
                      variant='outline'
                      className='border-red-300 text-red-700 hover:bg-red-50'
                    >
                      Restart from Bridge
                    </Button>
                    <Button
                      onClick={resetFlow}
                      size='sm'
                      variant='outline'
                      className='border-red-300 text-red-700 hover:bg-red-50'
                    >
                      Start Over
                    </Button>
                  </div>
                </div>
              )}

              {(depositStatus?.status === 'failed' ||
                depositStatus?.status === 'claim_failed' ||
                depositStatus?.status === 'processing_interrupted') && (
                <div className='bg-red-50 dark:bg-red-900/20 rounded-lg p-4'>
                  <div className='flex items-center gap-2 text-red-500 text-sm mb-2'>
                    <AlertCircle className='w-4 h-4' />
                    <span className='font-medium'>
                      {depositStatus?.status === 'processing_interrupted'
                        ? 'Process Interrupted'
                        : 'Process Failed'}
                    </span>
                  </div>
                  <p className='text-red-700 dark:text-red-300 text-sm mb-3'>
                    {depositStatus?.status === 'processing_interrupted'
                      ? depositStatus?.note ||
                        'The deposit process was interrupted. This may happen if the transaction was already processed.'
                      : depositStatus?.error ||
                        'The deposit process failed. You can try again or restart from the beginning.'}
                  </p>
                  <div className='flex gap-2'>
                    <Button
                      onClick={restartFromInitiate}
                      size='sm'
                      variant='outline'
                      className='border-red-300 text-red-700 hover:bg-red-50'
                    >
                      Restart Bridge Process
                    </Button>
                    <Button
                      onClick={resetFlow}
                      size='sm'
                      variant='outline'
                      className='border-red-300 text-red-700 hover:bg-red-50'
                    >
                      Start Over
                    </Button>
                  </div>
                </div>
              )}

              <Button
                onClick={handleClaimTokens}
                className='w-full'
                disabled={
                  claimMutation.isPending ||
                  !!error ||
                  depositStatus?.status === 'failed' ||
                  depositStatus?.status === 'claim_failed' ||
                  depositStatus?.status === 'processing_interrupted' ||
                  depositStatus?.status === 'auto_claiming' ||
                  (depositStatus?.status !== 'ready_to_claim' &&
                    depositStatus?.status !== 'completed')
                }
                variant={
                  depositStatus?.status === 'completed' ? 'outline' : 'default'
                }
              >
                {claimMutation.isPending ? (
                  <>
                    <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                    Claiming...
                  </>
                ) : depositStatus?.status === 'completed' ? (
                  <>
                    <Check className='w-4 h-4 mr-2' />
                    Tokens Claimed - Finishing...
                  </>
                ) : depositStatus?.status === 'auto_claiming' ? (
                  <>
                    <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                    Auto-claiming tokens...
                  </>
                ) : depositStatus?.status !== 'ready_to_claim' ? (
                  <>
                    <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                    Waiting for confirmation...
                  </>
                ) : (
                  <>
                    {depositStatus?.status === 'ready_to_claim'
                      ? 'Claim Tokens'
                      : 'Call claim_erc20'}
                    <ArrowRight className='w-4 h-4 ml-2' />
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Step 5: Complete */}
          {currentStep === 'complete' && (
            <div className='space-y-4'>
              <div className='text-center py-8'>
                <div className='w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4'>
                  <Check className='w-8 h-8 text-green-600' />
                </div>
                <h3 className='text-lg font-semibold mb-2'>Bridge Complete!</h3>
                <p className='text-muted-foreground'>
                  Your tokens have been successfully bridged to Solana
                </p>
              </div>

              <div className='bg-muted/30 rounded-lg p-4'>
                <div className='text-center space-y-2'>
                  <div className='text-2xl font-bold text-green-600'>
                    +{amount}
                  </div>
                  <div className='text-sm text-muted-foreground'>
                    {selectedTokenInfo?.symbol} added to your balance
                  </div>
                </div>
              </div>

              <Button onClick={resetFlow} className='w-full' variant='outline'>
                Bridge More Tokens
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
