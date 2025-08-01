export class RelayerService {
  async notifyDeposit({
    userAddress,
    erc20Address,
    ethereumAddress,
  }: {
    userAddress: string;
    erc20Address: string;
    ethereumAddress: string;
  }): Promise<void> {
    await fetch('/api/relayer/notify-deposit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress, erc20Address, ethereumAddress }),
    });
  }

  async notifyWithdrawal({
    userAddress,
    requestId,
    erc20Address,
    amount,
    recipient,
  }: {
    userAddress: string;
    requestId: string;
    erc20Address: string;
    amount: string;
    recipient: string;
  }): Promise<void> {
    await fetch('/api/relayer/notify-withdrawal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userAddress,
        requestId,
        erc20Address,
        amount,
        recipient,
      }),
    });
  }
}
