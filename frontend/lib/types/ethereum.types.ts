import type { Hex } from 'viem';

// Ethereum Transaction Types
export interface EthereumTransaction {
  type: number;
  chainId: number;
  nonce: number;
  maxPriorityFeePerGas: bigint;
  maxFeePerGas: bigint;
  gasLimit: bigint;
  to: string;
  value: bigint;
  data: string;
}

// Ethereum Signature Types
export interface EthereumSignature {
  r: Hex;
  s: Hex;
  v: bigint;
}
