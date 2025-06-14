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

    /// Request a signature from the chain signatures program (optimized - direct accounts)
    ///
    /// # Arguments
    /// * `program_id` - The chain signatures program ID
    /// * `program_state` - The chain signatures program state account
    /// * `requester` - The account requesting the signature
    /// * `fee_payer` - Optional fee payer account
    /// * `system_program` - System program account
    /// * `payload` - The 32-byte hash to be signed
    /// * `key_version` - Version of the key to use for signing
    /// * `path` - Derivation path for the key
    /// * `algo` - Signing algorithm to use
    /// * `dest` - Destination chain/address
    /// * `params` - Additional parameters as JSON string
    /// * `signer_seeds` - Optional signer seeds for PDA signing
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

        // Use Anchor's instruction builder to ensure consistent serialization
        let mut accounts = vec![
            AccountMeta::new(*program_state, false),
            AccountMeta::new(*requester, true),
        ];

        // Add fee_payer if provided - it must be a signer when present
        if let Some(fee_payer_key) = fee_payer {
            accounts.push(AccountMeta::new(*fee_payer_key, true)); // fee_payer: Option<Signer<'info>>
        }

        accounts.push(AccountMeta::new_readonly(*system_program, false)); // system_program: Program<'info, System>

        let discriminator = hash(b"global:sign").to_bytes();

        let mut data = Vec::new();

        data.extend_from_slice(&discriminator[0..8]);

        // Serialize parameters in the same order as the destination program expects
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
