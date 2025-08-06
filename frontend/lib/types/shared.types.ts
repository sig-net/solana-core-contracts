import type { Hex } from 'viem';
import type { BN } from '@coral-xyz/anchor';

export interface StatusCallback {
  (status: {
    status: string;
    txHash?: string;
    note?: string;
    error?: string;
  }): void;
}

export interface EvmTransactionRequest {
  type: number;
  chainId: number;
  nonce: number;
  to: Hex;
  value: bigint;
  data: Hex;
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}

export interface EvmTransactionProgramParams {
  value: BN;
  gasLimit: BN;
  maxFeePerGas: BN;
  maxPriorityFeePerGas: BN;
  nonce: BN;
  chainId: BN;
}
