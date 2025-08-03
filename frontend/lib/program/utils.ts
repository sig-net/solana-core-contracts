import { PublicKey } from '@solana/web3.js';
import { ethers } from 'ethers';
import { BN } from '@coral-xyz/anchor';

import { alchemy } from '../services/alchemy-service';

export interface EvmTransactionParams {
  value: bigint;
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  nonce: bigint;
  chainId: bigint;
}

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
 * Create EVM transaction parameters for Sepolia testnet with dynamic gas estimation
 */
export async function createEvmTransactionParams(
  nonce: number,
  gasLimit: number,
  useDynamicGas = true,
): Promise<EvmTransactionParams> {
  let maxFeePerGas: bigint;
  let maxPriorityFeePerGas: bigint;

  if (useDynamicGas) {
    try {
      console.log(
        '[GAS_ESTIMATION] Fetching current gas prices from network...',
      );
      const feeData = await alchemy.core.getFeeData();

      if (feeData?.maxFeePerGas && feeData?.maxPriorityFeePerGas) {
        // Add 20% buffer to ensure transaction is competitive
        const bufferMultiplier = 1.2;
        maxFeePerGas = BigInt(
          Math.floor(Number(feeData.maxFeePerGas) * bufferMultiplier),
        );
        maxPriorityFeePerGas = BigInt(
          Math.floor(Number(feeData.maxPriorityFeePerGas) * bufferMultiplier),
        );

        console.log('[GAS_ESTIMATION] Using dynamic gas prices:', {
          original: {
            maxFeePerGas: feeData.maxFeePerGas.toString(),
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas.toString(),
          },
          withBuffer: {
            maxFeePerGas: maxFeePerGas.toString(),
            maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
          },
        });
      } else {
        throw new Error('Invalid fee data received from network');
      }
    } catch (error) {
      console.warn(
        '[GAS_ESTIMATION] Failed to fetch dynamic gas prices, using fallback:',
        error,
      );
      // Fallback to higher default values if network call fails
      maxFeePerGas = ethers.parseUnits('50', 'gwei'); // Increased from 30
      maxPriorityFeePerGas = ethers.parseUnits('5', 'gwei'); // Increased from 2
    }
  } else {
    // Use fallback values (higher than original defaults)
    maxFeePerGas = ethers.parseUnits('50', 'gwei');
    maxPriorityFeePerGas = ethers.parseUnits('5', 'gwei');
  }

  return {
    value: BigInt(0),
    gasLimit: BigInt(gasLimit),
    maxFeePerGas,
    maxPriorityFeePerGas,
    nonce: BigInt(nonce),
    chainId: BigInt(11155111), // Sepolia testnet
  };
}

/**
 * Convert EVM transaction params to the format expected by the program
 */
export function evmParamsToProgram(params: EvmTransactionParams) {
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
