use anchor_lang::prelude::*;

/// State account for the chain signatures program
#[account]
pub struct ChainSignaturesProgramState {
    /// Administrator of the chain signatures program
    pub admin: Pubkey,
    /// Required deposit amount for signature requests
    pub signature_deposit: u64,
}
