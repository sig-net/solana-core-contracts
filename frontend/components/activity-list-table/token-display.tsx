import { CryptoIcon } from '../balance-display/crypto-icon';

interface TokenDisplayProps {
  token?: {
    symbol: string;
    chain: string;
    amount: string;
    usdValue: string;
  };
}

export function TokenDisplay({ token }: TokenDisplayProps) {
  if (!token) return null;

  return (
    <div className='flex gap-4 items-center'>
      <CryptoIcon chain={token.chain} token={token.symbol} />
      <div className='flex flex-col gap-1'>
        <div className='font-medium text-sm text-stone-600'>{token.amount}</div>
        <div className='font-semibold text-xs text-stone-400'>
          {token.usdValue}
        </div>
      </div>
    </div>
  );
}
