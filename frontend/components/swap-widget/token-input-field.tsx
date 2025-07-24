import { TokenMetadata } from '@/lib/constants/token-metadata';

import { TokenAmountInput } from './token-amount-input';
import { TokenSelector } from './token-selector';

interface TokenInputFieldProps {
  amount: string;
  onAmountChange: (amount: string) => void;
  selectedToken: TokenMetadata | null;
  onTokenSelect: () => void;
  placeholder?: string;
}

export function TokenInputField({
  amount,
  onAmountChange,
  selectedToken,
  onTokenSelect,
  placeholder = '0',
}: TokenInputFieldProps) {
  return (
    <div className='bg-pastels-swiss-coffee-200 border-dark-neutral-400/80 flex w-full items-center justify-between rounded-sm border p-5'>
      <TokenAmountInput
        amount={amount}
        onAmountChange={onAmountChange}
        placeholder={placeholder}
        inputClassName='h-auto'
      />
      <TokenSelector
        selectedToken={selectedToken}
        onTokenSelect={onTokenSelect}
      />
    </div>
  );
}
