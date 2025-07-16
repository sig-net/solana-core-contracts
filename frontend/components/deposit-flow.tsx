'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  ArrowRight,
  ExternalLink,
  Check,
  Clock,
  AlertCircle,
  Loader2,
} from 'lucide-react';

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
import {
  useDepositErc20Mutation,
  useClaimErc20Mutation,
} from '@/hooks/use-solana-queries';
import { useDepositStatus } from '@/hooks/use-deposit-status';
import { deriveUserEthereumAddress } from '@/lib/program/utils';

const SEPOLIA_TOKENS = [
  {
    address: '0xbe72e441bf55620febc26715db68d3494213d8cb',
    symbol: 'TOKEN1',
    name: 'Test Token 1',
    decimals: 6,
  },
  {
    address: '0x58eb19ef91e8a6327fed391b51ae1887b833cc91',
    symbol: 'TOKEN2',
    name: 'Test Token 2',
    decimals: 6,
  },
];

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

  const depositMutation = useDepositErc20Mutation();
  const claimMutation = useClaimErc20Mutation();
  const depositStatus = useDepositStatus(requestId);

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
      });

      console.log('Deposit request ID:', requestIdResult);
      // Store the request ID for claiming
      setRequestId(requestIdResult);
      setCurrentStep('claim');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to initiate bridge',
      );
    }
  };

  const handleClaimTokens = async () => {
    if (!publicKey || !requestId) return;

    setError('');

    try {
      const txSignature = await claimMutation.mutateAsync({
        requestId: requestId,
      });

      console.log('Claim transaction signature:', txSignature);
      setCurrentStep('complete');
      onRefreshBalances();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim tokens');
    }
  };

  const resetFlow = () => {
    setCurrentStep('select');
    setSelectedToken('');
    setAmount('');
    setRequestId('');
    setError('');
  };

  const selectedTokenInfo = SEPOLIA_TOKENS.find(
    t => t.address === selectedToken,
  );

  return (
    <Card className='w-full max-w-2xl mx-auto'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <div className='w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center'>
            <ArrowRight className='h-4 w-4 text-blue-600 dark:text-blue-400' />
          </div>
          Bridge ERC20 Tokens
        </CardTitle>
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
                <div className='flex items-center gap-2 text-red-500 text-sm'>
                  <AlertCircle className='w-4 h-4' />
                  {error}
                </div>
              )}

              <div className='flex gap-2'>
                <Button
                  variant='outline'
                  onClick={() => setCurrentStep('deposit')}
                  className='flex-1'
                  disabled={depositMutation.isPending}
                >
                  Back
                </Button>
                <Button
                  onClick={handleInitiateBridge}
                  className='flex-1'
                  disabled={depositMutation.isPending}
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
                        depositStatus.data?.status === 'waiting_signature' ||
                        depositStatus.data?.status === 'submitting_ethereum' ||
                        depositStatus.data?.status === 'confirming_ethereum' ||
                        depositStatus.data?.status ===
                          'waiting_read_response' ||
                        depositStatus.data?.status === 'ready_to_claim'
                          ? 'bg-green-500'
                          : 'bg-gray-300 animate-pulse'
                      }`}
                    ></div>
                    <span className='text-sm'>
                      {depositStatus.data?.status === 'waiting_signature' ||
                      depositStatus.data?.status === 'submitting_ethereum' ||
                      depositStatus.data?.status === 'confirming_ethereum' ||
                      depositStatus.data?.status === 'waiting_read_response' ||
                      depositStatus.data?.status === 'ready_to_claim'
                        ? 'Transaction signed by MPC'
                        : 'Waiting for MPC signature...'}
                    </span>
                  </div>
                  <div className='flex items-center gap-2'>
                    <div
                      className={`w-4 h-4 rounded-full ${
                        depositStatus.data?.status === 'confirming_ethereum' ||
                        depositStatus.data?.status ===
                          'waiting_read_response' ||
                        depositStatus.data?.status === 'ready_to_claim'
                          ? 'bg-green-500'
                          : depositStatus.data?.status === 'submitting_ethereum'
                            ? 'bg-blue-500 animate-pulse'
                            : 'bg-gray-300'
                      }`}
                    ></div>
                    <span className='text-sm'>
                      {depositStatus.data?.status === 'confirming_ethereum' ||
                      depositStatus.data?.status === 'waiting_read_response' ||
                      depositStatus.data?.status === 'ready_to_claim'
                        ? 'Ethereum transaction confirmed!'
                        : depositStatus.data?.status === 'submitting_ethereum'
                          ? 'Submitting to Ethereum...'
                          : 'Waiting for Ethereum submission...'}
                    </span>
                  </div>
                  <div className='flex items-center gap-2'>
                    <div
                      className={`w-4 h-4 rounded-full ${
                        depositStatus.data?.status === 'ready_to_claim'
                          ? 'bg-green-500'
                          : depositStatus.data?.status ===
                              'waiting_read_response'
                            ? 'bg-blue-500 animate-pulse'
                            : 'bg-gray-300'
                      }`}
                    ></div>
                    <span className='text-sm'>
                      {depositStatus.data?.status === 'ready_to_claim'
                        ? 'Ready to claim!'
                        : depositStatus.data?.status === 'waiting_read_response'
                          ? 'Waiting for read response...'
                          : 'Waiting for transaction result...'}
                    </span>
                  </div>
                  {depositStatus.data?.txHash && (
                    <div className='mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs'>
                      <span className='font-medium'>TX Hash: </span>
                      <code className='break-all'>
                        {depositStatus.data.txHash}
                      </code>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className='flex items-center gap-2 text-red-500 text-sm'>
                  <AlertCircle className='w-4 h-4' />
                  {error}
                </div>
              )}

              <Button
                onClick={handleClaimTokens}
                className='w-full'
                disabled={
                  claimMutation.isPending ||
                  depositStatus.data?.status !== 'ready_to_claim'
                }
              >
                {claimMutation.isPending ? (
                  <>
                    <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                    Claiming...
                  </>
                ) : depositStatus.data?.status !== 'ready_to_claim' ? (
                  <>
                    <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                    Waiting for confirmation...
                  </>
                ) : (
                  <>
                    Call claim_erc20
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
