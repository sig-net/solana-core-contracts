use alloy_primitives::{Address, U256};
use alloy_sol_types::SolCall;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::keccak;
use anchor_lang::solana_program::secp256k1_recover::secp256k1_recover;
use borsh::{BorshDeserialize, BorshSchema, BorshSerialize};
use chain_signatures::cpi::accounts::SignRespond;
use chain_signatures::cpi::sign_respond;
use chain_signatures::SerializationFormat;
use omni_transaction::{TransactionBuilder, TxBuilder, EVM};

use crate::state::vault::{EvmTransactionParams, IERC20};
use crate::{ClaimErc20, DepositErc20};

const HARDCODED_RECIPIENT: &str = "0x00A40C2661293d5134E53Da52951A3F7767836Ef";

#[derive(BorshSerialize, BorshDeserialize, BorshSchema)]
pub struct NonFunctionCallResult {
    pub message: String,
}

#[derive(BorshSerialize, BorshDeserialize, BorshSchema)]
pub struct Erc20TransferResult {
    pub success: bool,
}

pub fn deposit_erc20(
    ctx: Context<DepositErc20>,
    request_id: [u8; 32],
    erc20_address: [u8; 20],
    amount: u128,
    tx_params: EvmTransactionParams,
) -> Result<()> {
    let authority = ctx.accounts.authority.key();
    let path = authority.to_string();

    // Create ERC20 transfer call
    let recipient_bytes = hex::decode(&HARDCODED_RECIPIENT[2..])
        .map_err(|_| crate::error::ErrorCode::InvalidAddress)?;
    let recipient = Address::from_slice(&recipient_bytes);
    let call = IERC20::transferCall {
        to: recipient,
        amount: U256::from(amount),
    };

    // Build EVM transaction
    let evm_tx = TransactionBuilder::new::<EVM>()
        .nonce(tx_params.nonce)
        .to(erc20_address)
        .value(tx_params.value)
        .input(call.abi_encode())
        .max_priority_fee_per_gas(tx_params.max_priority_fee_per_gas)
        .max_fee_per_gas(tx_params.max_fee_per_gas)
        .gas_limit(tx_params.gas_limit)
        .chain_id(tx_params.chain_id)
        .build();

    let rlp_encoded_tx = evm_tx.build_for_signing();

    // Add detailed logging
    msg!("=== REQUEST ID CALCULATION DEBUG ===");
    msg!("Sender (requester): {}", ctx.accounts.requester.key());
    msg!("Transaction data length: {}", rlp_encoded_tx.len());
    msg!(
        "Transaction data (first 32 bytes): {:?}",
        &rlp_encoded_tx[..32.min(rlp_encoded_tx.len())]
    );
    msg!("SLIP44 chain ID: {}", 60);
    msg!("Key version: {}", 0);
    msg!("Path: {}", path);
    msg!("Algo: {}", "ECDSA");
    msg!("Dest: {}", "ethereum");
    msg!("Params: {}", "");

    // Generate request ID and verify it matches the one passed in
    let computed_request_id = generate_sign_respond_request_id(
        &ctx.accounts.requester.key(),
        &rlp_encoded_tx,
        60, // Ethereum SLIP-44
        0,  // key_version
        &path,
        "ECDSA",
        "ethereum",
        "",
    );

    msg!("Computed request ID: {:?}", computed_request_id);
    msg!("Provided request ID: {:?}", request_id);
    msg!("Request IDs match: {}", computed_request_id == request_id);

    require!(
        computed_request_id == request_id,
        crate::error::ErrorCode::InvalidRequestId
    );

    // Store pending deposit info
    let pending = &mut ctx.accounts.pending_deposit;
    pending.requester = authority;
    pending.amount = amount;
    pending.erc20_address = erc20_address;
    pending.path = path.clone();
    pending.request_id = request_id;

    // Create schema for ERC20 transfer return value from alloy-sol-types
    let functions = IERC20::abi::functions();
    let transfer_func = functions
        .get("transfer")
        .and_then(|funcs| funcs.first())
        .ok_or(crate::error::ErrorCode::FunctionNotFound)?;

    let explorer_schema = serde_json::to_vec(&transfer_func.outputs)
        .map_err(|_| crate::error::ErrorCode::SerializationError)?;

    let callback_schema = serde_json::to_vec(&serde_json::json!("bool"))
        .map_err(|_| crate::error::ErrorCode::SerializationError)?;

    // CPI to sign_respond
    let authority_key = ctx.accounts.authority.key();
    let requester_bump = ctx.bumps.requester;
    let authority_key_bytes = authority_key.to_bytes();
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"vault_authority",
        authority_key_bytes.as_ref(),
        &[requester_bump],
    ]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.chain_signatures_program.to_account_info(),
        SignRespond {
            program_state: ctx.accounts.chain_signatures_state.to_account_info(),
            requester: ctx.accounts.requester.to_account_info(),
            fee_payer: ctx
                .accounts
                .fee_payer
                .as_ref()
                .map(|fp| fp.to_account_info()),
            system_program: ctx.accounts.system_program.to_account_info(),
            instructions: ctx
                .accounts
                .instructions
                .as_ref()
                .map(|i| i.to_account_info()),
        },
        signer_seeds,
    );

    sign_respond(
        cpi_ctx,
        rlp_encoded_tx,
        60, // Ethereum SLIP-44
        0,  // key_version
        path,
        "ECDSA".to_string(),
        "ethereum".to_string(),
        "".to_string(),
        SerializationFormat::AbiJson,
        explorer_schema,
        SerializationFormat::Borsh,
        callback_schema,
    )?;

    msg!("ERC20 deposit initiated with request_id: {:?}", request_id);

    Ok(())
}

pub fn claim_erc20(
    ctx: Context<ClaimErc20>,
    request_id: [u8; 32],
    serialized_output: Vec<u8>,
    signature: chain_signatures::Signature,
) -> Result<()> {
    let pending = &ctx.accounts.pending_deposit;

    // Verify signature
    let message_hash = hash_message(&request_id, &serialized_output);

    // Verify the signature
    verify_signature_from_address(&message_hash, &signature, HARDCODED_RECIPIENT)?;

    msg!("Signature verified successfully");

    // Deserialize directly as bool (server now sends just the boolean)
    let success: bool = BorshDeserialize::try_from_slice(&serialized_output)
        .map_err(|_| crate::error::ErrorCode::InvalidOutput)?;

    require!(success, crate::error::ErrorCode::TransferFailed);

    // Update user balance
    let balance = &mut ctx.accounts.user_balance;
    balance.amount = balance
        .amount
        .checked_add(pending.amount)
        .ok_or(crate::error::ErrorCode::Overflow)?;

    msg!(
        "ERC20 deposit claimed successfully. New balance: {}",
        balance.amount
    );

    Ok(())
}

// Add this helper function to verify signature by recovering address
fn verify_signature_from_address(
    message_hash: &[u8; 32],
    signature: &chain_signatures::Signature,
    expected_address: &str,
) -> Result<()> {
    // Validate recovery ID
    require!(
        signature.recovery_id < 4,
        crate::error::ErrorCode::InvalidSignature
    );

    // Prepare signature for secp256k1_recover
    let mut sig_bytes = [0u8; 64];
    sig_bytes[..32].copy_from_slice(&signature.big_r.x);
    sig_bytes[32..].copy_from_slice(&signature.s);

    // Recover the public key
    let recovered_pubkey = secp256k1_recover(message_hash, signature.recovery_id, &sig_bytes)
        .map_err(|_| crate::error::ErrorCode::InvalidSignature)?;

    // Convert public key to Ethereum address
    // The recovered key is 64 bytes (without the 0x04 prefix)
    let pubkey_bytes = recovered_pubkey.to_bytes();

    // Hash the public key to get address
    let pubkey_hash = keccak::hash(&pubkey_bytes);
    let address_bytes = &pubkey_hash.to_bytes()[12..]; // Last 20 bytes

    // Convert to hex string for comparison
    let recovered_address = format!("0x{}", hex::encode(address_bytes));

    // Compare addresses (case-insensitive)
    require!(
        recovered_address.to_lowercase() == expected_address.to_lowercase(),
        crate::error::ErrorCode::InvalidSignature
    );

    Ok(())
}

// Helper functions

fn generate_sign_respond_request_id(
    sender: &Pubkey,
    transaction_data: &[u8],
    slip44_chain_id: u32,
    key_version: u32,
    path: &str,
    algo: &str,
    dest: &str,
    params: &str,
) -> [u8; 32] {
    use alloy_sol_types::SolValue;

    msg!("=== generate_sign_respond_request_id ===");
    msg!("Encoding with abi_encode_packed");

    // Match TypeScript implementation using ABI encoding
    let encoded = (
        sender.to_string(),
        transaction_data,
        slip44_chain_id,
        key_version,
        path,
        algo,
        dest,
        params,
    )
        .abi_encode_packed();

    msg!("Encoded data length: {}", encoded.len());
    msg!(
        "Encoded data (first 32 bytes): {:?}",
        &encoded[..32.min(encoded.len())]
    );

    let hash = keccak::hash(&encoded).to_bytes();
    msg!("Resulting hash: {:?}", hash);

    hash
}

fn hash_message(request_id: &[u8; 32], serialized_output: &[u8]) -> [u8; 32] {
    let mut data = Vec::with_capacity(32 + serialized_output.len());
    data.extend_from_slice(request_id);
    data.extend_from_slice(serialized_output);

    keccak::hash(&data).to_bytes()
}
