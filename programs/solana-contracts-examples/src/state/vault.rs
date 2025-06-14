use alloy_primitives::{Address, U256};
use alloy_sol_types::{sol, SolCall};
use anchor_lang::prelude::*;

sol! {
    interface IVault {
        function deposit(address to, uint256 amount) external;
        function withdraw(address to, uint256 amount) external;
    }
}

/// Represents a vault transaction to be processed
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct VaultTransaction {
    /// EVM contract address to call
    pub to_address: [u8; 20],
    /// Amount of ETH to send with the transaction
    pub value: u128,
    /// Gas limit for the transaction
    pub gas_limit: u128,
    /// Maximum fee per gas unit
    pub max_fee_per_gas: u128,
    /// Maximum priority fee per gas unit
    pub max_priority_fee_per_gas: u128,
    /// Transaction nonce
    pub nonce: u64,
    /// Chain ID for the target EVM network
    pub chain_id: u64,
    /// Recipient address for the vault operation
    pub recipient_address: [u8; 20],
    /// Amount to deposit or withdraw
    pub amount: u128,
}

impl VaultTransaction {
    /// Validates the transaction parameters
    pub fn validate(&self) -> Result<()> {
        require!(self.amount > 0, crate::error::ErrorCode::InvalidInputLength);
        require!(
            self.gas_limit > 21000,
            crate::error::ErrorCode::InvalidInputLength
        ); // Minimum gas for transfer
        require!(
            self.max_fee_per_gas > 0,
            crate::error::ErrorCode::InvalidInputLength
        );
        require!(
            self.chain_id > 0,
            crate::error::ErrorCode::InvalidInputLength
        );
        Ok(())
    }
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
    /// Validates the signing parameters
    pub fn validate(&self) -> Result<()> {
        require!(
            !self.path.is_empty(),
            crate::error::ErrorCode::InvalidInputLength
        );
        require!(
            !self.algo.is_empty(),
            crate::error::ErrorCode::InvalidInputLength
        );
        require!(
            !self.dest.is_empty(),
            crate::error::ErrorCode::InvalidInputLength
        );
        require!(
            self.path.len() <= 256,
            crate::error::ErrorCode::InvalidInputLength
        );
        require!(
            self.algo.len() <= 64,
            crate::error::ErrorCode::InvalidInputLength
        );
        require!(
            self.dest.len() <= 256,
            crate::error::ErrorCode::InvalidInputLength
        );
        require!(
            self.params.len() <= 1024,
            crate::error::ErrorCode::InvalidInputLength
        );
        Ok(())
    }
}

/// Trait for vault operations (deposit/withdraw)
pub trait VaultOperation {
    type Call: SolCall;

    /// Creates a Solidity function call for this operation
    fn create_call(recipient: Address, amount: U256) -> Self::Call;
}

/// Deposit operation implementation
pub struct DepositOp;

/// Withdraw operation implementation
pub struct WithdrawOp;

impl VaultOperation for DepositOp {
    type Call = IVault::depositCall;

    fn create_call(recipient: Address, amount: U256) -> Self::Call {
        IVault::depositCall {
            to: recipient,
            amount,
        }
    }
}

impl VaultOperation for WithdrawOp {
    type Call = IVault::withdrawCall;

    fn create_call(recipient: Address, amount: U256) -> Self::Call {
        IVault::withdrawCall {
            to: recipient,
            amount,
        }
    }
}

impl From<VaultTransaction> for (Address, U256) {
    fn from(tx: VaultTransaction) -> Self {
        (Address::from(tx.recipient_address), U256::from(tx.amount))
    }
}

// Account structures

/// Accounts for processing vault transactions (debugging)
#[derive(Accounts)]
pub struct ProcessVault {}

/// Accounts for requesting vault transaction signatures
#[derive(Accounts)]
pub struct SignVaultTransaction<'info> {
    /// The account requesting the signature
    #[account(mut)]
    pub requester: Signer<'info>,

    /// Optional separate account to pay signature fees
    #[account(mut)]
    pub fee_payer: Option<Signer<'info>>,

    /// Chain signatures program state account
    #[account(
        mut,
        seeds = [crate::constants::CHAIN_SIGNATURES_STATE_SEED],
        bump,
        seeds::program = chain_signatures_program.key()
    )]
    pub chain_signatures_state: Account<'info, crate::state::ChainSignaturesProgramState>,

    /// The chain signatures program
    #[account(
        constraint = chain_signatures_program.key().to_string() == crate::constants::CHAIN_SIGNATURES_PROGRAM_ID
            @ crate::error::ErrorCode::InvalidChainSignaturesProgram
    )]
    pub chain_signatures_program: Program<'info, crate::cpi::ChainSignatures>,

    /// System program for account operations
    pub system_program: Program<'info, System>,
}
