import { ethers } from 'ethers';
import { secp256k1 } from '@noble/curves/secp256k1';

import { CHAIN_SIGNATURES_CONFIG } from '@/lib/constants/chain-signatures.constants';

export interface Point {
  x: bigint;
  y: bigint;
}

/**
 * CryptographyService handles all cryptographic operations for key derivation
 * and address generation in the bridge system.
 */
export class CryptographyService {
  /**
   * Derive epsilon value for key derivation based on requester and path
   */
  static deriveEpsilon(requester: string, path: string): bigint {
    const derivationPath = `${CHAIN_SIGNATURES_CONFIG.EPSILON_DERIVATION_PREFIX},${CHAIN_SIGNATURES_CONFIG.SOLANA_CHAIN_ID},${requester},${path}`;
    const hash = ethers.keccak256(ethers.toUtf8Bytes(derivationPath));
    return BigInt(hash);
  }

  /**
   * Convert uncompressed public key string to elliptic curve point
   */
  static publicKeyToPoint(publicKey: string): Point {
    // Remove 0x04 prefix for uncompressed key
    const cleanPubKey = publicKey.slice(4);
    const x = cleanPubKey.slice(0, 64);
    const y = cleanPubKey.slice(64, 128);

    return {
      x: BigInt('0x' + x),
      y: BigInt('0x' + y),
    };
  }

  /**
   * Convert elliptic curve point to uncompressed public key string
   */
  static pointToPublicKey(point: Point): string {
    const x = point.x.toString(16).padStart(64, '0');
    const y = point.y.toString(16).padStart(64, '0');
    return '0x04' + x + y;
  }

  /**
   * Derive public key using epsilon derivation and base public key
   * This implements the MPC key derivation algorithm
   */
  static derivePublicKey(
    path: string,
    requesterAddress: string,
    basePublicKey: string,
  ): string {
    try {
      const epsilon = this.deriveEpsilon(requesterAddress, path);
      const basePoint = this.publicKeyToPoint(basePublicKey);

      // Calculate epsilon * G using secp256k1 curve
      const epsilonPoint = secp256k1.ProjectivePoint.BASE.multiply(epsilon);

      // Convert base point to projective coordinates
      const baseProjectivePoint = new secp256k1.ProjectivePoint(
        basePoint.x,
        basePoint.y,
        BigInt(1),
      );

      // Add points: result = base + epsilon * G
      const resultPoint = epsilonPoint.add(baseProjectivePoint);
      const resultAffine = resultPoint.toAffine();

      return this.pointToPublicKey({
        x: resultAffine.x,
        y: resultAffine.y,
      });
    } catch (error) {
      throw new Error(
        `Key derivation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Derive Ethereum address from public key and path
   */
  static deriveEthereumAddress(
    path: string,
    requesterAddress: string,
    basePublicKey: string,
  ): string {
    const derivedPublicKey = this.derivePublicKey(
      path,
      requesterAddress,
      basePublicKey,
    );
    return ethers.computeAddress(derivedPublicKey);
  }
}
