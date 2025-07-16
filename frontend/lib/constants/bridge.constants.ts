import { PublicKey } from '@solana/web3.js';

import type { DepositErc20Schema } from '../types/bridge.types';

// Bridge Program ID
export const BRIDGE_PROGRAM_ID = new PublicKey(
  'GDMMWC3YiZEffb2u5dw6FTLRY5wV5vAcXP72LRAJaVhK',
);

// PDA Seeds
export const BRIDGE_PDA_SEEDS = {
  VAULT_AUTHORITY: 'vault_authority',
  PENDING_ERC20_DEPOSIT: 'pending_erc20_deposit',
  USER_ERC20_BALANCE: 'user_erc20_balance',
  PROGRAM_STATE: 'program-state',
} as const;

// Borsh Schema for Deposit ERC20
export const DEPOSIT_ERC20_BORSH_SCHEMA: DepositErc20Schema = {
  struct: {
    requestId: { array: { type: 'u8', len: 32 } },
    erc20Address: { array: { type: 'u8', len: 20 } },
    amount: 'u128',
    txParams: {
      struct: {
        value: 'u128',
        gasLimit: 'u128',
        maxFeePerGas: 'u128',
        maxPriorityFeePerGas: 'u128',
        nonce: 'u64',
        chainId: 'u64',
      },
    },
  },
} as const;
