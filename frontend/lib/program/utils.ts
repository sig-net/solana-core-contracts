import { PublicKey } from '@solana/web3.js';
import { ethers } from 'ethers';
import { BN } from '@coral-xyz/anchor';

import { getAlchemyProvider } from '../utils/providers';
import type {
  EvmTransactionRequest,
  EvmTransactionProgramParams,
} from '../types/shared.types';

/**
 * Generate a request ID matching the Rust implementation
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
  const txDataArray = Array.from(transactionData);
  const txDataHex = '0x' + Buffer.from(txDataArray).toString('hex');

  const encoded = ethers.solidityPacked(
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
      txDataHex,
      slip44ChainId,
      keyVersion,
      path,
      algo,
      dest,
      params,
    ],
  );

  const hash = ethers.keccak256(encoded);

  return hash;
}

/**
 * Create base EVM transaction parameters for Sepolia testnet with dynamic gas estimation.
 * Returns only the gas and fee parameters - caller must provide to, data, value, etc.
 */
export async function createEvmTransactionBaseParams(
  nonce: number,
  gasLimit: number,
): Promise<
  Pick<
    EvmTransactionRequest,
    | 'nonce'
    | 'gasLimit'
    | 'maxFeePerGas'
    | 'maxPriorityFeePerGas'
    | 'chainId'
    | 'type'
  >
> {
  const feeData = await getAlchemyProvider().core.getFeeData();

  const bufferMultiplier = 1.2;

  return {
    type: 2, // EIP-1559
    nonce,
    gasLimit: BigInt(gasLimit),
    maxFeePerGas: BigInt(
      Math.floor(Number(feeData.maxFeePerGas) * bufferMultiplier),
    ),
    maxPriorityFeePerGas: BigInt(
      Math.floor(Number(feeData.maxPriorityFeePerGas) * bufferMultiplier),
    ),
    chainId: 11155111, // Sepolia testnet
  };
}

/**
 * Convert EVM transaction params to the format expected by the Solana program
 */
export function evmParamsToProgram(
  params: Pick<
    EvmTransactionRequest,
    | 'value'
    | 'gasLimit'
    | 'maxFeePerGas'
    | 'maxPriorityFeePerGas'
    | 'nonce'
    | 'chainId'
  >,
): EvmTransactionProgramParams {
  return {
    value: new BN(params.value.toString()),
    gasLimit: new BN(params.gasLimit.toString()),
    maxFeePerGas: new BN(params.maxFeePerGas.toString()),
    maxPriorityFeePerGas: new BN(params.maxPriorityFeePerGas.toString()),
    nonce: new BN(params.nonce.toString()),
    chainId: new BN(params.chainId.toString()),
  };
}

/**
 * Convert hex string to byte array
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleaned = hex.replace(/^0x/, '');
  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < cleaned.length; i += 2) {
    bytes[i / 2] = parseInt(cleaned.substr(i, 2), 16);
  }
  return bytes;
}
