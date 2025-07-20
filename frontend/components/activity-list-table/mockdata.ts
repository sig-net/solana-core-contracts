export const ACTIVITY_DATA = [
  {
    id: '1',
    type: 'Send' as const,
    fromToken: {
      symbol: 'BTC',
      chain: 'bitcoin',
      amount: '0.013 BTC',
      usdValue: '$1478.35',
    },
    address: '0x10B4…6dFa',
    timestamp: 'July 8, 2025 07:18 PM',
    status: 'pending' as const,
  },
  {
    id: '2',
    type: 'Swap' as const,
    fromToken: {
      symbol: 'ETH',
      chain: 'ethereum',
      amount: '0.5 ETH',
      usdValue: '$1478.35',
    },
    toToken: {
      symbol: 'BTC',
      chain: 'bitcoin',
      amount: '0.013 BTC',
      usdValue: '$1478.35',
    },
    timestamp: 'July 8, 2025 07:18 PM',
    status: 'completed' as const,
  },
  {
    id: '3',
    type: 'Deposit' as const,
    fromToken: {
      symbol: 'ETH',
      chain: 'ethereum',
      amount: '0.5 ETH',
      usdValue: '$1478.35',
    },
    address: '0x10B4…6dFa',
    timestamp: 'July 8, 2025 07:18 PM',
    status: 'completed' as const,
  },
];