// Deposit Transaction Parameters
export interface DepositTransactionParams {
  value: bigint;
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  nonce: bigint;
  chainId: bigint;
}

// Decoded Deposit Instruction
export interface DecodedDepositInstruction {
  requestId: number[];
  erc20Address: number[];
  amount: bigint;
  txParams: DepositTransactionParams;
}

// Borsh Schema for Deposit ERC20
export interface DepositErc20Schema {
  struct: {
    requestId: { array: { type: 'u8'; len: 32 } };
    erc20Address: { array: { type: 'u8'; len: 20 } };
    amount: 'u128';
    txParams: {
      struct: {
        value: 'u128';
        gasLimit: 'u128';
        maxFeePerGas: 'u128';
        maxPriorityFeePerGas: 'u128';
        nonce: 'u64';
        chainId: 'u64';
      };
    };
  };
}

// Pending Deposit Types
export interface PendingErc20Deposit {
  requestId: string;
  amount: string;
  erc20Address: string;
  requester: string;
  pda: string;
}
