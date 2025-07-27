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

// Base props for loading states
export interface BaseLoadingStateProps {
  message?: string;
  className?: string;
}

// Base props for error states
export interface BaseErrorStateProps {
  error: string;
  onRetry?: () => void;
  className?: string;
}