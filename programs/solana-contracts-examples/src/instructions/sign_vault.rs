use anchor_lang::prelude::*;

use crate::cpi::chain_signatures;
use crate::instructions::process_vault::process_vault_transaction;
use crate::state::vault::*;

/// Process a deposit transaction and request signature from chain signatures program
pub fn sign_deposit_transaction(
    ctx: Context<SignVaultTransaction>,
    tx: VaultTransaction,
    signing_params: SigningParams,
) -> Result<()> {
    // Validate inputs
    tx.validate()?;
    signing_params.validate()?;

    let tx_hash = process_vault_transaction::<DepositOp>(tx)?;
    request_signature(ctx, tx_hash, signing_params)
}

/// Process a withdrawal transaction and request signature from chain signatures program
pub fn sign_withdraw_transaction(
    ctx: Context<SignVaultTransaction>,
    tx: VaultTransaction,
    signing_params: SigningParams,
) -> Result<()> {
    // Validate inputs
    tx.validate()?;
    signing_params.validate()?;

    let tx_hash = process_vault_transaction::<WithdrawOp>(tx)?;
    request_signature(ctx, tx_hash, signing_params)
}

/// Internal helper to request signature from chain signatures program
fn request_signature(
    ctx: Context<SignVaultTransaction>,
    payload: [u8; 32],
    signing_params: SigningParams,
) -> Result<()> {
    let cpi_program = ctx.accounts.chain_signatures_program.to_account_info();
    let cpi_accounts = chain_signatures::cpi::accounts::Sign {
        program_state: ctx.accounts.chain_signatures_state.to_account_info(),
        requester: ctx.accounts.requester.to_account_info(),
        fee_payer: ctx
            .accounts
            .fee_payer
            .as_ref()
            .map(|fp| fp.to_account_info()),
        system_program: ctx.accounts.system_program.to_account_info(),
    };

    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

    chain_signatures::cpi::sign(
        cpi_ctx,
        payload,
        signing_params.key_version,
        signing_params.path,
        signing_params.algo,
        signing_params.dest,
        signing_params.params,
    )
}
