use crate::{error::ErrorCode, state::chain_signatures::SignatureRequest};
use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash;
use anchor_lang::solana_program::instruction::AccountMeta;

#[derive(Clone)]
pub struct ChainSignatures;

impl anchor_lang::Id for ChainSignatures {
    fn id() -> Pubkey {
        crate::constants::CHAIN_SIGNATURES_PROGRAM_ID
            .parse()
            .expect("Invalid chain signatures program ID")
    }
}

#[derive(Accounts)]
pub struct SignAccounts<'info> {
    /// CHECK: This is the chain signatures program state account
    #[account(mut)]
    pub program_state: AccountInfo<'info>,

    /// CHECK: This is the account requesting the signature
    #[account(mut)]
    pub requester: AccountInfo<'info>,

    /// CHECK: Optional fee payer for the signature request
    pub fee_payer: Option<AccountInfo<'info>>,

    /// CHECK: System program for account operations
    pub system_program: AccountInfo<'info>,
}

pub mod cpi {
    use super::*;

    pub fn sign<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, SignAccounts<'info>>,
        request: SignatureRequest,
    ) -> Result<()> {
        let instruction = build_sign_instruction(&ctx.accounts, &request)?;

        let mut account_infos = Vec::with_capacity(4);
        account_infos.push(ctx.accounts.program_state.to_account_info());
        account_infos.push(ctx.accounts.requester.to_account_info());

        if let Some(fee_payer) = &ctx.accounts.fee_payer {
            account_infos.push(fee_payer.to_account_info());
        }

        account_infos.push(ctx.accounts.system_program.to_account_info());

        anchor_lang::solana_program::program::invoke_signed(
            &instruction,
            &account_infos,
            ctx.signer_seeds,
        )
        .map_err(Into::into)
    }

    fn build_sign_instruction(
        accounts: &SignAccounts,
        request: &SignatureRequest,
    ) -> Result<anchor_lang::solana_program::instruction::Instruction> {
        let mut account_metas = Vec::with_capacity(4);
        account_metas.push(AccountMeta::new(*accounts.program_state.key, false));
        account_metas.push(AccountMeta::new(*accounts.requester.key, true));

        if let Some(fee_payer) = &accounts.fee_payer {
            account_metas.push(AccountMeta::new(*fee_payer.key, true));
        }

        account_metas.push(AccountMeta::new_readonly(
            *accounts.system_program.key,
            false,
        ));

        let discriminator = hash(b"global:sign").to_bytes();

        let estimated_size = request.estimated_serialized_size();
        let mut data = Vec::with_capacity(estimated_size);
        data.extend_from_slice(&discriminator[0..8]);

        request
            .serialize(&mut data)
            .map_err(|_| ErrorCode::SerializationError)?;

        Ok(anchor_lang::solana_program::instruction::Instruction {
            program_id: ChainSignatures::id(),
            accounts: account_metas,
            data,
        })
    }
}
