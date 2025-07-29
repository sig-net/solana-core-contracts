import { PublicKey } from '@solana/web3.js';

// Solana Core Contracts Program ID
export const BRIDGE_PROGRAM_ID = new PublicKey(
  'GDMMWC3YiZEffb2u5dw6FTLRY5wV5vAcXP72LRAJaVhK',
);

// PDA Seeds
export const BRIDGE_PDA_SEEDS = {
  VAULT_AUTHORITY: 'vault_authority',
  GLOBAL_VAULT_AUTHORITY: 'global_vault_authority',
  PENDING_ERC20_DEPOSIT: 'pending_erc20_deposit',
  PENDING_ERC20_WITHDRAWAL: 'pending_erc20_withdrawal',
  USER_ERC20_BALANCE: 'user_erc20_balance',
  PROGRAM_STATE: 'program-state',
} as const;
