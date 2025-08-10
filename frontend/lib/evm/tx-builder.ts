import { ethers } from 'ethers';
import { encodeFunctionData, erc20Abi, type Hex } from 'viem';

import { SERVICE_CONFIG } from '@/lib/constants/service.config';
import type { EvmTransactionRequest } from '@/lib/types/shared.types';

export function encodeErc20Transfer(recipient: string, amount: bigint): Hex {
  return encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [recipient as Hex, amount],
  });
}

export async function buildErc20TransferTx(params: {
  provider: ethers.AbstractProvider;
  from: string;
  erc20Address: string;
  recipient: string;
  amount: bigint;
}): Promise<EvmTransactionRequest> {
  const { provider, from, erc20Address, recipient, amount } = params;

  const nonce = await provider.getTransactionCount(from);

  const data = encodeErc20Transfer(recipient, amount);

  const estimatedGas = await provider.estimateGas({
    from,
    to: erc20Address,
    data,
    value: 0,
  });
  const gasLimit = (estimatedGas * BigInt(120)) / BigInt(100); // 20% buffer

  const feeData = await provider.getFeeData();
  const maxPriorityFeePerGas =
    feeData.maxPriorityFeePerGas ?? ethers.parseUnits('2', 'gwei');
  const maxFeePerGas = feeData.maxFeePerGas ?? ethers.parseUnits('20', 'gwei');

  const txRequest: EvmTransactionRequest = {
    type: 2,
    chainId: SERVICE_CONFIG.ETHEREUM.CHAIN_ID,
    nonce,
    maxPriorityFeePerGas,
    maxFeePerGas,
    gasLimit,
    to: erc20Address as Hex,
    value: BigInt(0),
    data,
  };

  return txRequest;
}
