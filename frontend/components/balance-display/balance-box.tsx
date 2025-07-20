'use client';

import { cn } from '@/lib/utils';

import { ActionButtons } from './action-buttons';

export function BalanceBox({
  amount,
  usdValue,
  tokenSymbol,
  icon,
  className,
}: {
  amount: string;
  usdValue: string;
  tokenSymbol: string;
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('flex items-center border-t border-[#A28B8A]', className)}
      style={{
        gap: '67px',
        padding: '20px 0px',
        width: '100%',
      }}
    >
      <div
        className='flex'
        style={{
          flexDirection: 'row',
          gap: '10px',
          width: '176px',
        }}
      >
        <div
          className='flex flex-col'
          style={{
            gap: '7px',
            width: '100px',
          }}
        >
          <div
            style={{
              fontFamily:
                'Test Söhne Mono, ui-monospace, SFMono-Regular, Consolas, monospace',
              fontWeight: 300,
              fontSize: '32px',
              lineHeight: '1.5em',
              textAlign: 'left',
              color: '#6C6060',
            }}
          >
            {amount}
          </div>

          <div
            style={{
              fontFamily:
                'Test Söhne Mono, ui-monospace, SFMono-Regular, Consolas, monospace',
              fontWeight: 600,
              fontSize: '14px',
              lineHeight: '1.5em',
              letterSpacing: '-0.01em',
              textAlign: 'left',
              color: '#9C8686',
            }}
          >
            {usdValue}
          </div>
        </div>

        <div
          className='flex items-center'
          style={{
            gap: '6px',
          }}
        >
          {icon}
          <span
            style={{
              fontFamily: 'Elza Text, system-ui, sans-serif',
              fontWeight: 700,
              fontSize: '16px',
              lineHeight: '1.5em',
              letterSpacing: '-0.01em',
              textAlign: 'left',
              color: '#6C6060',
            }}
          >
            {tokenSymbol}
          </span>
        </div>
      </div>

      <div
        className='flex'
        style={{
          gap: '20px',
        }}
      >
        <ActionButtons />
      </div>
    </div>
  );
}
