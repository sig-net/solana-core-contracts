use alloy_primitives::{Address, U256};
use alloy_sol_types::{sol, SolCall};
use anchor_lang::prelude::*;
use chain_signatures;

sol! {
    interface IVault {
        function deposit(address to, uint256 amount) external;
        function withdraw(address to, uint256 amount) external;
    }
}

// Add ERC20 interface
sol! {
    #[sol(abi)]
    interface IERC20 {
        function transfer(address to, uint256 amount) external returns (bool);
    }
}

// PDA for storing pending ERC20 deposits
#[account]
pub struct PendingErc20Deposit {
    pub requester: Pubkey,
    pub amount: u128,
    pub erc20_address: [u8; 20],
    pub path: String,
    pub request_id: [u8; 32],
}

impl PendingErc20Deposit {
    pub const MAX_PATH_LEN: usize = 64;

    pub fn space() -> usize {
        8 + // discriminator
        32 + // requester
        16 + // amount (u128)
        20 + // erc20_address
        4 + Self::MAX_PATH_LEN + // path string
        32 // request_id
    }
}

#[account]
pub struct PendingErc20Withdrawal {
    pub requester: Pubkey,
    pub amount: u128,
    pub erc20_address: [u8; 20],
    pub recipient_address: [u8; 20],
    pub path: String,
    pub request_id: [u8; 32],
}

impl PendingErc20Withdrawal {
    pub const fn space() -> usize {
        8 +  // discriminator
        32 + // requester
        16 + // amount (u128)
        20 + // erc20_address
        20 + // recipient_address
        4 + 64 + // path (string with max length)
        32 // request_id
    }
}

// PDA for storing user ERC20 balances
#[account]
pub struct UserErc20Balance {
    pub amount: u128,
}

impl UserErc20Balance {
    pub fn space() -> usize {
        8 + // discriminator
        16 // amount (u128)
    }
}

// Transaction parameters for EVM
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct EvmTransactionParams {
    pub value: u128,
    pub gas_limit: u128,
    pub max_fee_per_gas: u128,
    pub max_priority_fee_per_gas: u128,
    pub nonce: u64,
    pub chain_id: u64,
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
    /// The user authority that owns this vault
    pub authority: Signer<'info>,

    /// User-specific vault authority PDA that acts as the requester
    #[account(
        mut,
        seeds = [b"vault_authority", authority.key().as_ref()],
        bump
    )]
    pub requester: SystemAccount<'info>,

    /// Optional separate account to pay signature fees
    #[account(mut)]
    pub fee_payer: Option<Signer<'info>>,

    /// Chain signatures program state account
    /// CHECK: This account is owned by the chain signatures program and validated by the CPI call
    #[account(
        mut,
        seeds = [crate::constants::CHAIN_SIGNATURES_STATE_SEED],
        bump,
        seeds::program = chain_signatures_program.key()
    )]
    pub chain_signatures_state: AccountInfo<'info>,

    /// The chain signatures program
    #[account(
        constraint = chain_signatures_program.key().to_string() == crate::constants::CHAIN_SIGNATURES_PROGRAM_ID
            @ crate::error::ErrorCode::InvalidChainSignaturesProgram
    )]
    pub chain_signatures_program: Program<'info, chain_signatures::program::ChainSignaturesProject>,
    pub system_program: Program<'info, System>,
    pub instructions: Option<AccountInfo<'info>>,
}
