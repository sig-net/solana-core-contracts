use anchor_lang::prelude::*;

use crate::cpi::chain_signatures;
use crate::instructions::process_vault::process_vault_transaction;
use crate::state::vault::*;

pub fn sign_deposit_transaction(
    ctx: Context<SignVaultTransaction>,
    tx: VaultTransaction,
    signing_params: SigningParams,
) -> Result<()> {
    let tx_hash = process_vault_transaction::<DepositOp>(tx)?;
    request_signature(ctx, tx_hash, &signing_params)
}

pub fn sign_withdraw_transaction(
    ctx: Context<SignVaultTransaction>,
    tx: VaultTransaction,
    signing_params: SigningParams,
) -> Result<()> {
    let tx_hash = process_vault_transaction::<WithdrawOp>(tx)?;
    request_signature(ctx, tx_hash, &signing_params)
}

fn request_signature(
    ctx: Context<SignVaultTransaction>,
    payload: [u8; 32],
    signing_params: &SigningParams,
) -> Result<()> {
    let chain_signatures_program_info = ctx.accounts.chain_signatures_program.to_account_info();
    let chain_signatures_state_info = ctx.accounts.chain_signatures_state.to_account_info();
    let requester_info = ctx.accounts.requester.to_account_info();
    let system_program_info = ctx.accounts.system_program.to_account_info();
    let fee_payer_info = ctx
        .accounts
        .fee_payer
        .as_ref()
        .map(|fp| fp.to_account_info());

    chain_signatures::cpi::sign_direct(
        chain_signatures_program_info,
        chain_signatures_state_info,
        requester_info,
        fee_payer_info,
        system_program_info,
        payload,
        signing_params.key_version,
        &signing_params.path,
        &signing_params.algo,
        &signing_params.dest,
        &signing_params.params,
        &[],
    )
}
