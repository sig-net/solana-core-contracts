use anchor_lang::prelude::*;

pub mod constants;
pub mod cpi;
pub mod error;
pub mod instructions;
pub mod state;

pub use constants::*;
pub use cpi::*;
pub use error::ErrorCode;
pub use state::*;

declare_id!("aQqiZQWrXxK3gjXPbRNg9S9EC3PjwSn4HEz9ntSFoFS");

#[program]
pub mod solana_core_contracts {
    use super::*;

    /// Process a vault deposit transaction and return the hash to be signed
    /// This method is kept for debugging purposes
    pub fn process_deposit(ctx: Context<ProcessVault>, tx: VaultTransaction) -> Result<[u8; 32]> {
        instructions::process_vault::process_deposit(ctx, tx)
    }

    /// Process a vault withdrawal transaction and return the hash to be signed
    /// This method is kept for debugging purposes
    pub fn process_withdraw(ctx: Context<ProcessVault>, tx: VaultTransaction) -> Result<[u8; 32]> {
        instructions::process_vault::process_withdraw(ctx, tx)
    }

    /// Process a vault deposit transaction and request signature via chain signatures
    pub fn sign_deposit_transaction(
        ctx: Context<SignVaultTransaction>,
        tx: VaultTransaction,
        signing_params: SigningParams,
    ) -> Result<()> {
        instructions::sign_vault::sign_deposit_transaction(ctx, tx, signing_params)
    }

    /// Process a vault withdrawal transaction and request signature via chain signatures
    pub fn sign_withdraw_transaction(
        ctx: Context<SignVaultTransaction>,
        tx: VaultTransaction,
        signing_params: SigningParams,
    ) -> Result<()> {
        instructions::sign_vault::sign_withdraw_transaction(ctx, tx, signing_params)
    }
}
