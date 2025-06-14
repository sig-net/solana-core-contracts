use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash;

#[derive(Clone)]
pub struct ChainSignatures;

impl anchor_lang::Id for ChainSignatures {
    fn id() -> Pubkey {
        crate::constants::CHAIN_SIGNATURES_PROGRAM_ID
            .parse()
            .expect("Invalid chain signatures program ID")
    }
}

pub mod cpi {

    use super::*;
    use crate::error::ErrorCode;

    pub mod accounts {
        use super::*;

        #[derive(Accounts)]
        pub struct Sign<'info> {
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
    }

    pub fn sign_direct<'info>(
        program_id: AccountInfo<'info>,
        program_state: AccountInfo<'info>,
        requester: AccountInfo<'info>,
        fee_payer: Option<AccountInfo<'info>>,
        system_program: AccountInfo<'info>,
        payload: [u8; 32],
        key_version: u32,
        path: &str,
        algo: &str,
        dest: &str,
        params: &str,
        signer_seeds: &[&[&[u8]]],
    ) -> Result<()> {
        let instruction = build_sign_instruction(
            program_id.key,
            program_state.key,
            requester.key,
            system_program.key,
            fee_payer.as_ref().map(|fp| fp.key),
            payload,
            key_version,
            path,
            algo,
            dest,
            params,
        )?;

        // Use account references directly - minimal cloning!
        if let Some(fee_payer) = fee_payer {
            let account_infos = [
                program_state.clone(),
                requester.clone(),
                system_program.clone(),
                fee_payer.clone(),
            ];
            anchor_lang::solana_program::program::invoke_signed(
                &instruction,
                &account_infos,
                signer_seeds,
            )
        } else {
            let account_infos = [
                program_state.clone(),
                requester.clone(),
                system_program.clone(),
            ];
            anchor_lang::solana_program::program::invoke_signed(
                &instruction,
                &account_infos,
                signer_seeds,
            )
        }
        .map_err(Into::into)
    }

    fn build_sign_instruction(
        program_id: &Pubkey,
        program_state: &Pubkey,
        requester: &Pubkey,
        system_program: &Pubkey,
        fee_payer: Option<&Pubkey>,
        payload: [u8; 32],
        key_version: u32,
        path: &str,
        algo: &str,
        dest: &str,
        params: &str,
    ) -> Result<anchor_lang::solana_program::instruction::Instruction> {
        use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};

        let mut accounts = vec![
            AccountMeta::new(*program_state, false),
            AccountMeta::new(*requester, true),
        ];

        if let Some(fee_payer_key) = fee_payer {
            accounts.push(AccountMeta::new(*fee_payer_key, true));
        }

        accounts.push(AccountMeta::new_readonly(*system_program, false));

        let discriminator = hash(b"global:sign").to_bytes();

        let mut data = Vec::new();

        data.extend_from_slice(&discriminator[0..8]);

        payload
            .serialize(&mut data)
            .map_err(|_| ErrorCode::SerializationError)?;
        key_version
            .serialize(&mut data)
            .map_err(|_| ErrorCode::SerializationError)?;
        path.serialize(&mut data)
            .map_err(|_| ErrorCode::SerializationError)?;
        algo.serialize(&mut data)
            .map_err(|_| ErrorCode::SerializationError)?;
        dest.serialize(&mut data)
            .map_err(|_| ErrorCode::SerializationError)?;
        params
            .serialize(&mut data)
            .map_err(|_| ErrorCode::SerializationError)?;

        let instruction = Instruction {
            program_id: *program_id,
            accounts,
            data,
        };

        Ok(instruction)
    }
}
