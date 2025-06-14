use anchor_lang::prelude::*;

pub mod constants;
pub mod cpi;
pub mod error;
pub mod instructions;
pub mod state;

pub use constants::*;
pub use error::ErrorCode;
pub use state::*;

declare_id!("aQqiZQWrXxK3gjXPbRNg9S9EC3PjwSn4HEz9ntSFoFS");

#[program]
pub mod solana_core_contracts {
    use super::*;

    pub fn process_deposit(ctx: Context<ProcessVault>, tx: VaultTransaction) -> Result<[u8; 32]> {
        instructions::process_vault::process_deposit(ctx, tx)
    }

    pub fn process_withdraw(ctx: Context<ProcessVault>, tx: VaultTransaction) -> Result<[u8; 32]> {
        instructions::process_vault::process_withdraw(ctx, tx)
    }

    pub fn sign_deposit_transaction(
        ctx: Context<SignVaultTransaction>,
        tx: VaultTransaction,
        signing_params: SigningParams,
    ) -> Result<()> {
        instructions::sign_vault::sign_deposit_transaction(ctx, tx, signing_params)
    }

    pub fn sign_withdraw_transaction(
        ctx: Context<SignVaultTransaction>,
        tx: VaultTransaction,
        signing_params: SigningParams,
    ) -> Result<()> {
        instructions::sign_vault::sign_withdraw_transaction(ctx, tx, signing_params)
    }
}
