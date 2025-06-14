use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Not implemented")]
    NotImplemented,
    #[msg("Invalid chain signatures program")]
    InvalidChainSignaturesProgram,
    #[msg("Insufficient deposit for signature request")]
    InsufficientSignatureDeposit,
    #[msg("Invalid input length")]
    InvalidInputLength,
    #[msg("Serialization error")]
    SerializationError,
}
