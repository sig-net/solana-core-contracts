// Pending Deposit Types
export interface PendingErc20Deposit {
  requestId: string;
  amount: string;
  erc20Address: string;
  requester: string;
  pda: string;
}

// Deposit Status Types
export type DepositStatus =
  | 'processing'
  | 'waiting_signature'
  | 'submitting_ethereum'
  | 'confirming_ethereum'
  | 'waiting_read_response'
  | 'auto_claiming'
  | 'completed'
  | 'failed'
  | 'claim_failed'
  | 'processing_interrupted';
