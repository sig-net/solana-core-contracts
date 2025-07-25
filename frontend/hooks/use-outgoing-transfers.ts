'use client';

import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

import { queryKeys } from '@/lib/query-client';
import { useSolanaService } from './use-solana-service';
import { formatActivityDate } from '@/lib/utils/date-formatting';
import { ERC20_ADDRESSES } from '@/lib/constants/ethereum.constants';
import { getTransactionExplorerUrl } from '@/lib/utils/network-utils';

export interface OutgoingTransfer {
  requestId: string;
  transactionHash?: string;
  blockNumber?: bigint;
  logIndex: number;
  from: string;
  to: string;
  value: bigint;
  tokenAddress: string;
  recipient: string;
  timestamp?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface WithdrawalRequest {
  requestId: string;
  erc20Address: string;
  amount: string;
  recipient: string;
  timestamp: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  ethereumTxHash?: string;
}

async function fetchUserWithdrawals(
  publicKey: PublicKey,
  solanaService: any,
): Promise<WithdrawalRequest[]> {
  try {
    const withdrawals: WithdrawalRequest[] = [];
    
    // Use the new method to fetch user's pending withdrawals
    const pendingWithdrawals = await solanaService.bridgeContract.fetchUserPendingWithdrawals(publicKey);
    
    // Transform the pending withdrawals to our format
    for (const withdrawal of pendingWithdrawals) {
      const data = withdrawal.account;
      
      // Convert byte arrays to hex strings
      const erc20Address = '0x' + Buffer.from(data.erc20Address).toString('hex');
      const recipientAddress = '0x' + Buffer.from(data.recipientAddress).toString('hex');
      const requestId = Buffer.from(data.requestId).toString('hex');
      
      withdrawals.push({
        requestId,
        erc20Address,
        amount: data.amount.toString(),
        recipient: recipientAddress,
        timestamp: Date.now() / 1000, // Approximate timestamp
        status: 'pending', // All queried withdrawals are pending by default
        ethereumTxHash: undefined, // Would need additional lookup
      });
    }
    
    return withdrawals;
  } catch (error) {
    console.error('Error fetching user withdrawals:', error);
    return [];
  }
}

export function useOutgoingTransfers() {
  const { publicKey } = useWallet();
  const solanaService = useSolanaService();

  const query = useQuery({
    queryKey: publicKey 
      ? queryKeys.solana.outgoingTransfers(publicKey.toString())
      : [],
    queryFn: async (): Promise<OutgoingTransfer[]> => {
      if (!publicKey) throw new Error('No public key available');
      
      // Fetch user's withdrawal requests from Solana
      const withdrawalRequests = await fetchUserWithdrawals(publicKey, solanaService);
      
      // Transform withdrawal requests to OutgoingTransfer format
      return withdrawalRequests.map((request): OutgoingTransfer => ({
        requestId: request.requestId,
        transactionHash: request.ethereumTxHash,
        blockNumber: undefined,
        logIndex: 0,
        from: '0x041477de8ecbcf633cb13ea10aa86cdf4d437c29', // Main vault address
        to: request.recipient,
        value: BigInt(request.amount),
        tokenAddress: request.erc20Address,
        recipient: request.recipient,
        timestamp: request.timestamp,
        status: request.status,
      }));
    },
    enabled: !!publicKey,
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: 3,
    retryDelay: 1000,
  });

  return query;
}