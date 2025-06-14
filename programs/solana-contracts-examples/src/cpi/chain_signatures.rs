use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash;

// External program interface for chain signatures
#[derive(Clone)]
pub struct ChainSignatures;

impl anchor_lang::Id for ChainSignatures {
    fn id() -> Pubkey {
        crate::constants::CHAIN_SIGNATURES_PROGRAM_ID
            .parse()
            .expect("Invalid chain signatures program ID")
    }
}

// CPI module for chain signatures
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

    /// Request a signature from the chain signatures program
    ///
    /// # Arguments
    /// * `ctx` - The CPI context containing the accounts
    /// * `payload` - The 32-byte hash to be signed
    /// * `key_version` - Version of the key to use for signing
    /// * `path` - Derivation path for the key
    /// * `algo` - Signing algorithm to use
    /// * `dest` - Destination chain/address
    /// * `params` - Additional parameters as JSON string
    pub fn sign<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, accounts::Sign<'info>>,
        payload: [u8; 32],
        key_version: u32,
        path: String,
        algo: String,
        dest: String,
        params: String,
    ) -> Result<()> {
        // Validate string parameters
        require!(
            !path.is_empty() && path.len() <= 256,
            ErrorCode::InvalidInputLength
        );
        require!(
            !algo.is_empty() && algo.len() <= 64,
            ErrorCode::InvalidInputLength
        );
        require!(
            !dest.is_empty() && dest.len() <= 256,
            ErrorCode::InvalidInputLength
        );
        require!(params.len() <= 1024, ErrorCode::InvalidInputLength);

        let instruction = build_sign_instruction(
            &ctx.program.key(),
            &ctx.accounts.program_state.key(),
            &ctx.accounts.requester.key(),
            &ctx.accounts.system_program.key(),
            payload,
            key_version,
            path,
            algo,
            dest,
            params,
        )?;

        let account_infos = [
            ctx.accounts.program_state.clone(),
            ctx.accounts.requester.clone(),
            ctx.accounts.system_program.clone(),
        ];

        anchor_lang::solana_program::program::invoke_signed(
            &instruction,
            &account_infos,
            ctx.signer_seeds,
        )
        .map_err(Into::into)
    }

    fn calculate_instruction_data_size(path: &str, algo: &str, dest: &str, params: &str) -> usize {
        8  // discriminator
        + 32 // payload [u8; 32] 
        + 4  // key_version u32
        + 4 + path.len()    // String length prefix + content
        + 4 + algo.len()    // String length prefix + content  
        + 4 + dest.len()    // String length prefix + content
        + 4 + params.len() // String length prefix + content
    }

    fn build_sign_instruction(
        program_id: &Pubkey,
        program_state: &Pubkey,
        requester: &Pubkey,
        system_program: &Pubkey,
        payload: [u8; 32],
        key_version: u32,
        path: String,
        algo: String,
        dest: String,
        params: String,
    ) -> Result<anchor_lang::solana_program::instruction::Instruction> {
        use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};

        let mut data = Vec::with_capacity(calculate_instruction_data_size(
            &path, &algo, &dest, &params,
        ));

        let discriminator = hash(b"global:sign").to_bytes();
        data.extend_from_slice(&discriminator);

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
            accounts: vec![
                AccountMeta::new(*program_state, false),
                AccountMeta::new(*requester, true),
                AccountMeta::new_readonly(*system_program, false),
            ],
            data,
        };

        Ok(instruction)
    }
}
