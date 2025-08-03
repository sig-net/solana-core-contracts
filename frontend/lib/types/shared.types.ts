export interface StatusCallback {
  (status: {
    status: string;
    txHash?: string;
    note?: string;
    error?: string;
  }): void;
}
