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

const SEPOLIA_TOKENS = [
  {
    address: '0xbe72e441bf55620febc26715db68d3494213d8cb',
    symbol: 'TOKEN1',
    name: 'Test Token 1',
  },
  {
    address: '0x58eb19ef91e8a6327fed391b51ae1887b833cc91',
    symbol: 'TOKEN2',
    name: 'Test Token 2',
  },
];

const DEPOSIT_ADDRESS = '0x041477de8ecbcf633cb13ea10aa86cdf4d437c29';

type DepositStep = 'select' | 'deposit' | 'initiate' | 'claim' | 'complete';

interface DepositFlowProps {
  onRefreshBalances: () => void;
}

export function DepositFlow({ onRefreshBalances }: DepositFlowProps) {
  const { publicKey } = useWallet();
  const [currentStep, setCurrentStep] = useState<DepositStep>('select');
  const [selectedToken, setSelectedToken] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [txHash, setTxHash] = useState<string>('');
  const [requestId, setRequestId] = useState<string>('');
  const [error, setError] = useState<string>('');

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
      title: 'Send to Sepolia',
      description: 'Transfer ERC20 tokens to deposit address',
    },
    {
      id: 'initiate',
      title: 'Initiate Bridge',
      description: 'Call deposit_erc20 on Solana',
    },
    {
      id: 'claim',
      title: 'Claim Tokens',
      description: 'Call claim_erc20 to credit balance',
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
    if (!txHash) {
      setError('Please enter the transaction hash');
      return;
    }
    setError('');
    setCurrentStep('initiate');
  };

  const handleInitiateBridge = async () => {
    if (!publicKey || !selectedToken || !amount) return;

    setError('');

    try {
      // Generate a unique request ID
      const generatedRequestId = crypto.randomUUID();
      setRequestId(generatedRequestId);

      const txSignature = await depositMutation.mutateAsync({
        erc20Address: selectedToken,
        amount: amount,
        requestId: generatedRequestId,
      });

      console.log('Deposit transaction signature:', txSignature);
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
    setTxHash('');
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

          {/* Step 2: Deposit on Sepolia */}
          {currentStep === 'deposit' && (
            <div className='space-y-4'>
              <div className='text-center py-4'>
                <h3 className='text-lg font-semibold mb-2'>
                  Send Tokens to Sepolia
                </h3>
                <p className='text-muted-foreground'>
                  Transfer your ERC20 tokens to the deposit address
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

              <div className='bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4'>
                <div className='flex items-center gap-2 mb-2'>
                  <AlertCircle className='w-4 h-4 text-yellow-600' />
                  <span className='text-sm font-medium'>Deposit Address</span>
                </div>
                <div className='flex items-center gap-2 p-3 bg-white dark:bg-gray-800 rounded border'>
                  <code className='flex-1 text-sm font-mono break-all'>
                    {DEPOSIT_ADDRESS}
                  </code>
                  <CopyButton text={DEPOSIT_ADDRESS} size='sm' />
                </div>
              </div>

              <div>
                <Label htmlFor='txHash'>Transaction Hash (after sending)</Label>
                <Input
                  id='txHash'
                  placeholder='0x...'
                  value={txHash}
                  onChange={e => setTxHash(e.target.value)}
                />
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
                <Button
                  onClick={handleDepositComplete}
                  className='flex-1'
                  disabled={!txHash}
                >
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
                  Call deposit_erc20 on Solana to start the bridge process
                </p>
              </div>

              <div className='bg-muted/30 rounded-lg p-4'>
                <div className='flex items-center gap-2 mb-3'>
                  <Clock className='w-4 h-4 text-blue-500' />
                  <span className='text-sm font-medium'>
                    Transaction Details
                  </span>
                </div>
                <div className='space-y-2 text-sm'>
                  <div className='flex justify-between'>
                    <span>Sepolia TX:</span>
                    <div className='flex items-center gap-2'>
                      <code className='text-xs bg-muted px-2 py-1 rounded'>
                        {txHash.slice(0, 6)}...{txHash.slice(-4)}
                      </code>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() =>
                          window.open(
                            `https://sepolia.etherscan.io/tx/${txHash}`,
                            '_blank',
                          )
                        }
                      >
                        <ExternalLink className='w-3 h-3' />
                      </Button>
                    </div>
                  </div>
                </div>
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
                  Complete the bridge by calling claim_erc20
                </p>
              </div>

              <div className='bg-green-50 dark:bg-green-900/20 rounded-lg p-4'>
                <div className='flex items-center gap-2 mb-2'>
                  <Check className='w-4 h-4 text-green-600' />
                  <span className='text-sm font-medium'>Bridge Initiated</span>
                </div>
                <p className='text-sm text-muted-foreground'>
                  Your deposit has been initiated on Solana. Now claim your
                  tokens to complete the bridge.
                </p>
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
                disabled={claimMutation.isPending}
              >
                {claimMutation.isPending ? (
                  <>
                    <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                    Claiming...
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
