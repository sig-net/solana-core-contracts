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
    <div className='flex items-center gap-4'>
      <CryptoIcon chain={token.chain} token={token.symbol} />
      <div className='flex flex-col gap-1'>
        <div className='text-sm font-medium text-stone-600'>{token.amount}</div>
        <div className='text-xs font-semibold text-stone-400'>
          {token.usdValue}
        </div>
      </div>
    </div>
  );
}
