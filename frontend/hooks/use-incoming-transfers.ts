'use client';

import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Alchemy,
  Network,
  AssetTransfersCategory,
  SortingOrder,
} from 'alchemy-sdk';

import { ALL_TOKENS } from '@/lib/constants/token-metadata';
import { queryKeys } from '@/lib/query-client';

import { useDepositAddress } from './use-deposit-address';
import { useEnv } from './use-env';

export interface TransferEvent {
  transactionHash: string;
  blockNumber: bigint;
  blockHash: string;
  logIndex: number;
  from: string;
  to: string;
  value: bigint;
  tokenAddress: string;
  timestamp?: number;
}

async function fetchTransfersFromAlchemy(
  toAddress: string,
  alchemyApiKey: string,
): Promise<TransferEvent[]> {
  const alchemy = new Alchemy({
    apiKey: alchemyApiKey,
    network: Network.ETH_SEPOLIA,
  });

  const supportedTokens = ALL_TOKENS.map(token => token.address.toLowerCase());

  const response = await alchemy.core.getAssetTransfers({
    fromBlock: '0x0',
    toBlock: 'latest',
    toAddress: toAddress.toLowerCase(),
    category: [AssetTransfersCategory.ERC20],
    withMetadata: true,
    excludeZeroValue: true,
    maxCount: 10,
    order: SortingOrder.DESCENDING,
  });

  const transfers: TransferEvent[] = [];

  for (const transfer of response.transfers) {
    if (
      !supportedTokens.includes(
        transfer.rawContract?.address?.toLowerCase() || '',
      )
    ) {
      continue;
    }

    const blockNumber = BigInt(transfer.blockNum || '0');
    const value = BigInt(transfer.rawContract?.value || '0');

    // Get block timestamp using SDK
    let timestamp: number | undefined;
    try {
      const block = await alchemy.core.getBlock(Number(blockNumber));
      timestamp = block?.timestamp;
    } catch {
      // Ignore timestamp errors
    }

    const transferEvent: TransferEvent = {
      transactionHash: transfer.hash || '',
      blockNumber,
      blockHash: '',
      logIndex: 0,
      from: transfer.from || '',
      to: transfer.to || '',
      value,
      tokenAddress: transfer.rawContract?.address || '',
      timestamp,
    };

    transfers.push(transferEvent);
  }

  return transfers;
}

export function useIncomingTransfers() {
  const { publicKey } = useWallet();
  const { data: depositAddress } = useDepositAddress();
  const env = useEnv();

  const query = useQuery({
    queryKey:
      publicKey && depositAddress
        ? queryKeys.ethereum.incomingTransfers(depositAddress)
        : [],
    queryFn: async (): Promise<TransferEvent[]> => {
      if (!depositAddress) throw new Error('No deposit address available');

      return await fetchTransfersFromAlchemy(
        depositAddress,
        env.NEXT_PUBLIC_ALCHEMY_API_KEY,
      );
    },
    enabled: !!publicKey && !!depositAddress,
    staleTime: 30000,
    refetchInterval: 45000,
    refetchIntervalInBackground: false,
  });

  return query;
}
