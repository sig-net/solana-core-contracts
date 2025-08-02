// Shared status callback interface for operations like deposits and withdrawals
export interface StatusCallback {
  (status: {
    status: string;
    txHash?: string;
    note?: string;
    error?: string;
  }): void;
}

// Alias for deposit operations
export type DepositStatusCallback = StatusCallback;

// Alias for withdrawal operations
export type WithdrawalStatusCallback = StatusCallback;
