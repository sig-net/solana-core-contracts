use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid chain signatures program")]
    InvalidChainSignaturesProgram,
    #[msg("Serialization error")]
    SerializationError,
}
