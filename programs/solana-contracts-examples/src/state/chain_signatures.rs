use anchor_lang::prelude::*;

/// State account for the chain signatures program
#[account]
pub struct ChainSignaturesProgramState {
    /// Administrator of the chain signatures program
    pub admin: Pubkey,
    /// Required deposit amount for signature requests
    pub signature_deposit: u64,
}

/// Parameters for requesting a signature from the chain signatures program
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct SigningParams {
    /// Version of the key to use for signing
    pub key_version: u32,
    /// Derivation path for the key (e.g., "ethereum,1")
    pub path: String,
    /// Signing algorithm (e.g., "secp256k1")
    pub algo: String,
    /// Destination identifier
    pub dest: String,
    /// Additional parameters as JSON string
    pub params: String,
}

impl SigningParams {
    pub fn new(key_version: u32, path: &str, algo: &str, dest: &str, params: &str) -> Self {
        Self {
            key_version,
            path: path.to_string(),
            algo: algo.to_string(),
            dest: dest.to_string(),
            params: params.to_string(),
        }
    }
}

#[derive(Clone, AnchorSerialize)]
pub struct SignatureRequest {
    pub payload: [u8; 32],
    pub signing_params: SigningParams,
}

impl SignatureRequest {
    pub fn new(payload: [u8; 32], signing_params: SigningParams) -> Self {
        Self {
            payload,
            signing_params,
        }
    }

    pub fn estimated_serialized_size(&self) -> usize {
        const DISCRIMINATOR_SIZE: usize = 8;
        const PAYLOAD_SIZE: usize = 32;
        const KEY_VERSION_SIZE: usize = 4;
        const STRING_LENGTH_PREFIX: usize = 4; // Borsh uses 4-byte length prefix

        DISCRIMINATOR_SIZE
            + PAYLOAD_SIZE
            + KEY_VERSION_SIZE
            + STRING_LENGTH_PREFIX
            + self.signing_params.path.len()
            + STRING_LENGTH_PREFIX
            + self.signing_params.algo.len()
            + STRING_LENGTH_PREFIX
            + self.signing_params.dest.len()
            + STRING_LENGTH_PREFIX
            + self.signing_params.params.len()
    }
}
