import {
  keccak256,
  encodePacked,
  parseUnits,
  toBytes,
  TransactionSerializable,
  Hex,
  Address,
} from 'viem';
import { sepolia } from 'viem/chains';
import { PublicKey } from '@solana/web3.js';

/**
 * Create EVM transaction parameters with gas estimation
 */
export function createEvmTransactionParams(nonce: number) {
  // Match the exact gas settings from the working ethers version
  const gasLimit = BigInt(100000);
  const maxFeePerGas = parseUnits('30', 9); // 30 gwei
  const maxPriorityFeePerGas = parseUnits('2', 9); // 2 gwei

  return {
    gasLimit,
    maxFeePerGas,
    maxPriorityFeePerGas,
    nonce: BigInt(nonce),
    value: BigInt(0),
    chainId: BigInt(11155111), // Sepolia testnet
  };
}

/**
 * Compute Ethereum address from public key
 */
export function computeAddress(publicKey: string): Address {
  // Remove '0x04' prefix if present (uncompressed public key marker)
  const cleanPubKey = publicKey.startsWith('0x04')
    ? publicKey.slice(4)
    : publicKey;

  // Convert to bytes and compute keccak256 hash, then take last 20 bytes
  const pubKeyBytes = toBytes(`0x${cleanPubKey}` as Hex);
  const hash = keccak256(pubKeyBytes);

  // Take the last 20 bytes (40 characters) and add 0x prefix
  return `0x${hash.slice(-40)}` as Address;
}

/**
 * Create transaction object from parameters
 */
export function createTransaction(params: {
  to: Address;
  value?: bigint;
  data?: Hex;
  nonce: number;
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}): TransactionSerializable {
  return {
    type: 'eip1559',
    chainId: sepolia.id,
    to: params.to,
    value: params.value || BigInt(0),
    data: params.data,
    nonce: params.nonce,
    gas: params.gasLimit,
    maxFeePerGas: params.maxFeePerGas,
    maxPriorityFeePerGas: params.maxPriorityFeePerGas,
  };
}

/**
 * Create signed transaction from unsigned transaction and signature
 */
export function createSignedTransaction(
  transaction: TransactionSerializable,
  signature: { r: Hex; s: Hex; v: bigint },
): TransactionSerializable {
  return {
    ...transaction,
    r: signature.r,
    s: signature.s,
    v: signature.v,
  };
}

/**
 * Generate request ID matching the Rust implementation using viem
 * This must match exactly with the contract's generate_sign_respond_request_id function
 */
export function generateRequestId(
  sender: PublicKey,
  transactionData: Uint8Array,
  slip44ChainId: number,
  keyVersion: number,
  path: string,
  algo: string,
  dest: string,
  params: string,
): string {
  // The contract expects raw bytes, not hex-encoded
  const encoded = encodePacked(
    [
      'string',
      'bytes',
      'uint32',
      'uint32',
      'string',
      'string',
      'string',
      'string',
    ],
    [
      sender.toString(),
      `0x${Buffer.from(transactionData).toString('hex')}`,
      slip44ChainId,
      keyVersion,
      path,
      algo,
      dest,
      params,
    ],
  );

  const hash = keccak256(encoded);

  return hash;
}
