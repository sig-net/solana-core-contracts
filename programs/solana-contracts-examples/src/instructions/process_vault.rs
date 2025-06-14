use alloy_sol_types::SolCall;
use anchor_lang::prelude::*;
use omni_transaction::{TransactionBuilder, TxBuilder, EVM};
use sha3::{Digest, Keccak256};

use crate::state::vault::*;

/// Process a deposit transaction for debugging - returns transaction hash
pub fn process_deposit(_ctx: Context<ProcessVault>, tx: VaultTransaction) -> Result<[u8; 32]> {
    process_vault_transaction::<DepositOp>(tx)
}

/// Process a withdrawal transaction for debugging - returns transaction hash
pub fn process_withdraw(_ctx: Context<ProcessVault>, tx: VaultTransaction) -> Result<[u8; 32]> {
    process_vault_transaction::<WithdrawOp>(tx)
}

/// Internal function to process vault transactions generically
pub fn process_vault_transaction<Op: VaultOperation>(tx: VaultTransaction) -> Result<[u8; 32]> {
    let (recipient, amount) = tx.clone().into();
    let call = Op::create_call(recipient, amount);
    build_and_sign_transaction(tx, call)
}

/// Build an EVM transaction and compute its signing hash
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

    let hash_to_sign = Keccak256::new()
        .chain_update(&evm_tx.build_for_signing())
        .finalize();

    Ok(hash_to_sign.into())
}
