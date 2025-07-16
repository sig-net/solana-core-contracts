import type { Hex } from 'viem';

// Ethereum Signature Types
export interface EthereumSignature {
  r: Hex;
  s: Hex;
  v: bigint;
}
