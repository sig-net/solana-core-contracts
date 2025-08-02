import { PublicKey } from '@solana/web3.js';
import { ethers } from 'ethers';
import { secp256k1 } from '@noble/curves/secp256k1';
import { BN } from '@coral-xyz/anchor';

import { AlchemyService } from '../services/alchemy-service';

// Constants from the test file
const CONFIG = {
  BASE_PUBLIC_KEY:
    '0x044eef776e4f257d68983e45b340c2e9546c5df95447900b6aadfec68fb46fdee257e26b8ba383ddba9914b33c60e869265f859566fff4baef283c54d821ca3b64',
  EPSILON_DERIVATION_PREFIX: 'sig.network v1.0.0 epsilon derivation',
  SOLANA_CHAIN_ID: '0x800001f5',
};

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
      const feeData = await AlchemyService.getFeeData();

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

/**
 * Derive epsilon value for key derivation (matches test file)
 */
function deriveEpsilon(requester: string, path: string): bigint {
  const derivationPath = `${CONFIG.EPSILON_DERIVATION_PREFIX},${CONFIG.SOLANA_CHAIN_ID},${requester},${path}`;
  const hash = ethers.keccak256(ethers.toUtf8Bytes(derivationPath));
  return BigInt(hash);
}

/**
 * Convert public key string to elliptic curve point
 */
function publicKeyToPoint(publicKey: string): { x: bigint; y: bigint } {
  const cleanPubKey = publicKey.slice(4); // Remove 0x04 prefix
  const x = cleanPubKey.slice(0, 64);
  const y = cleanPubKey.slice(64, 128);
  return {
    x: BigInt('0x' + x),
    y: BigInt('0x' + y),
  };
}

/**
 * Convert elliptic curve point to public key string
 */
function pointToPublicKey(point: { x: bigint; y: bigint }): string {
  const x = point.x.toString(16).padStart(64, '0');
  const y = point.y.toString(16).padStart(64, '0');
  return '0x04' + x + y;
}

/**
 * Derive public key using epsilon and base public key (matches test file)
 */
function derivePublicKey(
  path: string,
  requesterAddress: string,
  basePublicKey: string,
): string {
  try {
    const epsilon = deriveEpsilon(requesterAddress, path);
    const basePoint = publicKeyToPoint(basePublicKey);

    // Calculate epsilon * G
    const epsilonPoint = secp256k1.ProjectivePoint.BASE.multiply(epsilon);

    // Convert base point to projective
    const baseProjectivePoint = new secp256k1.ProjectivePoint(
      basePoint.x,
      basePoint.y,
      BigInt(1),
    );

    // Add points: result = base + epsilon * G
    const resultPoint = epsilonPoint.add(baseProjectivePoint);
    const resultAffine = resultPoint.toAffine();

    const derivedPublicKey = pointToPublicKey({
      x: resultAffine.x,
      y: resultAffine.y,
    });

    return derivedPublicKey;
  } catch (error) {
    throw error;
  }
}

/**
 * Derive the user's Ethereum address from their Solana public key
 * This matches the algorithm in the test file using secp256k1 curve
 */
export function deriveUserEthereumAddress(publicKey: PublicKey): string {
  // Derive vault authority PDA (matches test file)
  const PROGRAM_ID = new PublicKey(
    'aQqiZQWrXxK3gjXPbRNg9S9EC3PjwSn4HEz9ntSFoFS',
  );
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault_authority'), publicKey.toBuffer()],
    PROGRAM_ID,
  );

  const path = publicKey.toString();
  const derivedPublicKey = derivePublicKey(
    path,
    vaultAuthority.toString(),
    CONFIG.BASE_PUBLIC_KEY,
  );

  // Convert secp256k1 public key to Ethereum address
  const derivedAddress = ethers.computeAddress(derivedPublicKey);

  return derivedAddress;
}
