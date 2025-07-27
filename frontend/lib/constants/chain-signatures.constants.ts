import { PublicKey } from '@solana/web3.js';

// Chain Signatures Program Configuration
export const CHAIN_SIGNATURES_CONFIG = {
  BASE_PUBLIC_KEY:
    '0x044eef776e4f257d68983e45b340c2e9546c5df95447900b6aadfec68fb46fdee257e26b8ba383ddba9914b33c60e869265f859566fff4baef283c54d821ca3b64',
  EPSILON_DERIVATION_PREFIX: 'sig.network v1.0.0 epsilon derivation',
  SOLANA_CHAIN_ID: '0x800001f5',
} as const;

// Chain Signatures Program ID
export const CHAIN_SIGNATURES_PROGRAM_ID = new PublicKey(
  '4uvZW8K4g4jBg7dzPNbb9XDxJLFBK7V6iC76uofmYvEU',
);

// Timeout Configuration for Chain Signatures Events
export const CHAIN_SIGNATURES_TIMEOUTS = {
  SIGNATURE_TIMEOUT: 300000, // 2 minutes
  READ_RESPONSE_TIMEOUT: 300000, // 5 minutes
} as const;
