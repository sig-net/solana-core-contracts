use anchor_lang::prelude::*;

use crate::cpi::SignAccounts;
use crate::instructions::process_vault::process_vault_transaction;
use crate::state::chain_signatures::{SignatureRequest, SigningParams};
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
    let request = SignatureRequest::new(payload, signing_params.clone());

    let authority_key = ctx.accounts.authority.key();
    let requester_bump = ctx.bumps.requester;
    let authority_key_bytes = authority_key.to_bytes();

    let signer_seeds: &[&[&[u8]]] = &[&[
        b"vault_authority",
        authority_key_bytes.as_ref(),
        &[requester_bump],
    ]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.chain_signatures_program.to_account_info(),
        SignAccounts {
            program_state: ctx.accounts.chain_signatures_state.to_account_info(),
            requester: ctx.accounts.requester.to_account_info(),
            fee_payer: ctx
                .accounts
                .fee_payer
                .as_ref()
                .map(|fp| fp.to_account_info()),
            system_program: ctx.accounts.system_program.to_account_info(),
        },
        signer_seeds,
    );

    crate::cpi::chain_signatures::cpi::sign(cpi_ctx, request)
}
