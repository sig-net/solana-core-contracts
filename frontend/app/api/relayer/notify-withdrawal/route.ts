import { NextRequest, NextResponse } from 'next/server';
import { Keypair } from '@solana/web3.js';
import NodeWallet from '@coral-xyz/anchor/dist/esm/nodewallet.js';

import {
  CrossChainOrchestrator,
  type EthereumTxParams,
} from '@/lib/services/cross-chain-orchestrator';
import { getFullEnv } from '@/lib/utils/env';
import {
  getSolanaConnection,
  getEthereumProvider,
} from '@/lib/utils/providers';

export async function POST(request: NextRequest) {
  try {
    const { requestId, erc20Address, transactionParams } = await request.json();

    if (!requestId || !erc20Address || !transactionParams) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: requestId, erc20Address and transactionParams',
        },
        { status: 400 },
      );
    }

    processWithdrawalInBackground(requestId, erc20Address, transactionParams);

    return NextResponse.json({
      success: true,
      message: 'Withdrawal processing started',
      requestId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}

async function processWithdrawalInBackground(
  requestId: string,
  erc20Address: string,
  transactionParams: {
    type: number;
    chainId: number;
    nonce: number;
    maxPriorityFeePerGas: string;
    maxFeePerGas: string;
    gasLimit: string;
    to: string;
    value: string;
    data: string;
  },
) {
  try {
    const env = getFullEnv();

    const connection = getSolanaConnection();
    const provider = getEthereumProvider();

    const relayerKeypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(env.RELAYER_PRIVATE_KEY)),
    );
    const relayerWallet = new NodeWallet(relayerKeypair);

    const orchestrator = new CrossChainOrchestrator(
      connection,
      relayerWallet,
      provider,
      { operationName: 'WITHDRAW' },
    );

    const result = await orchestrator.executeSignatureFlow(
      requestId,
      transactionParams as EthereumTxParams,
      async readEvent => {
        const bridgeContract = orchestrator.getBridgeContract();
        const requestIdBytes = bridgeContract.hexToBytes(requestId);
        const [pendingWithdrawalPda] =
          bridgeContract.derivePendingWithdrawalPda(requestIdBytes);
        const pendingWithdrawal =
          await bridgeContract.fetchPendingWithdrawal(pendingWithdrawalPda);
        const erc20AddressBytes = bridgeContract.hexToBytes(erc20Address);

        return await bridgeContract.completeWithdrawErc20({
          requester: pendingWithdrawal.requester,
          requestIdBytes,
          serializedOutput: readEvent.serializedOutput,
          signature: readEvent.signature,
          erc20AddressBytes,
        });
      },
    );

    if (result.success) {
      console.log(`[WITHDRAW] Ethereum tx: ${result.ethereumTxHash}`);
      console.log(`[WITHDRAW] Solana tx: ${result.solanaResult}`);
      console.log(`[WITHDRAW] Withdrawal completed successfully`);
    } else {
      throw new Error(result.error || 'Withdrawal failed');
    }
  } catch (error) {
    console.error('[WITHDRAW] Processing failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
