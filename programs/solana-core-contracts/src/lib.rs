use anchor_lang::prelude::*;
use omni_transaction::{TransactionBuilder, EVM};

declare_id!("8yavd91U7kY5bZQNYgYf1jj42GSYTLnDsRq8ZH2aaRY1");

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct EthereumTransaction {
    pub to_address: [u8; 20],
    pub value: u128,
    pub gas_limit: u128,
    pub max_fee_per_gas: u128,
    pub max_priority_fee_per_gas: u128,
    pub nonce: u64,
    pub chain_id: u64,
    pub data: Vec<u8>,
}

#[program]
pub mod solana_core_contracts {
    use omni_transaction::TxBuilder;

    use super::*;

    pub fn process_ethereum_transaction(
        ctx: Context<ProcessEthereumTransaction>,
        ethereum_tx: EthereumTransaction,
    ) -> Result<()> {
        msg!(
            "Processing Ethereum transaction on Solana program: {:?}",
            ctx.program_id
        );

        let evm_tx = TransactionBuilder::new::<EVM>()
            .nonce(ethereum_tx.nonce)
            .to(ethereum_tx.to_address)
            .value(ethereum_tx.value)
            .input(ethereum_tx.data)
            .max_priority_fee_per_gas(ethereum_tx.max_priority_fee_per_gas)
            .max_fee_per_gas(ethereum_tx.max_fee_per_gas)
            .gas_limit(ethereum_tx.gas_limit)
            .chain_id(ethereum_tx.chain_id)
            .build();

        let hash_to_sign = evm_tx.build_for_signing();

        msg!("Ethereum transaction hash to be signed: {:?}", hash_to_sign);

        Err(ErrorCode::NotImplemented.into())
    }
}

#[derive(Accounts)]
pub struct ProcessEthereumTransaction {}

#[error_code]
pub enum ErrorCode {
    #[msg("Not implemented")]
    NotImplemented,
}
