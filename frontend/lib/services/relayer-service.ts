import type { EthereumTxParams } from './cross-chain-orchestrator';

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
    requestId,
    erc20Address,
    transactionParams,
  }: {
    requestId: string;
    erc20Address: string;
    transactionParams?: EthereumTxParams;
  }): Promise<void> {
    const response = await fetch('/api/relayer/notify-withdrawal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        erc20Address,
        transactionParams,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Relayer notification failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return response.json();
  }
}
