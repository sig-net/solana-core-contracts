// Pending Deposit Types
export interface PendingErc20Deposit {
  requestId: string;
  amount: string;
  erc20Address: string;
  requester: string;
  pda: string;
}
