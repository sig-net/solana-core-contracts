use alloy_primitives::{Address, U256};
use alloy_sol_types::{sol, SolCall};
use anchor_lang::prelude::*;
use omni_transaction::{TransactionBuilder, TxBuilder, EVM};
use sha3::{Digest, Keccak256};

declare_id!("aQqiZQWrXxK3gjXPbRNg9S9EC3PjwSn4HEz9ntSFoFS");

sol! {
    interface IVault {
        function deposit(address to, uint256 amount) external;
        function withdraw(address to, uint256 amount) external;
    }
}

// Single transaction struct - no duplication
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct VaultTransaction {
    pub to_address: [u8; 20],
    pub value: u128,
    pub gas_limit: u128,
    pub max_fee_per_gas: u128,
    pub max_priority_fee_per_gas: u128,
    pub nonce: u64,
    pub chain_id: u64,
    pub recipient_address: [u8; 20], // 'to' parameter
    pub amount: u128,                // 'amount' parameter
}

// Trait for vault operations - more idiomatic approach
trait VaultOperation {
    type Call: SolCall;
    fn create_call(recipient: Address, amount: U256) -> Self::Call;
}

// Zero-sized types for compile-time dispatch
struct DepositOp;
struct WithdrawOp;

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

// Implement From trait for idiomatic conversions
impl From<VaultTransaction> for (Address, U256) {
    fn from(tx: VaultTransaction) -> Self {
        (Address::from(tx.recipient_address), U256::from(tx.amount))
    }
}

#[program]
pub mod solana_core_contracts {
    use super::*;

    pub fn process_deposit(_ctx: Context<ProcessVault>, tx: VaultTransaction) -> Result<[u8; 32]> {
        process_vault_transaction::<DepositOp>(tx)
    }

    pub fn process_withdraw(_ctx: Context<ProcessVault>, tx: VaultTransaction) -> Result<[u8; 32]> {
        process_vault_transaction::<WithdrawOp>(tx)
    }
}

// Generic function to eliminate code duplication
fn process_vault_transaction<Op: VaultOperation>(tx: VaultTransaction) -> Result<[u8; 32]> {
    let (recipient, amount) = tx.clone().into();
    let call = Op::create_call(recipient, amount);
    build_and_sign_transaction(tx, call)
}

// More idiomatic function name and implementation
fn build_and_sign_transaction<T: SolCall>(tx: VaultTransaction, call: T) -> Result<[u8; 32]> {
    let encoded_data = call.abi_encode();

    let evm_tx = TransactionBuilder::new::<EVM>()
        .nonce(tx.nonce)
        .to(tx.to_address)
        .value(tx.value)
        .input(encoded_data)
        .max_priority_fee_per_gas(tx.max_priority_fee_per_gas)
        .max_fee_per_gas(tx.max_fee_per_gas)
        .gas_limit(tx.gas_limit)
        .chain_id(tx.chain_id)
        .build();

    // More functional approach for hashing
    let hash_to_sign = Keccak256::new()
        .chain_update(&evm_tx.build_for_signing())
        .finalize();

    Ok(hash_to_sign.into())
}

// Single account context - no duplication
#[derive(Accounts)]
pub struct ProcessVault {}

#[error_code]
pub enum ErrorCode {
    #[msg("Not implemented")]
    NotImplemented,
}
