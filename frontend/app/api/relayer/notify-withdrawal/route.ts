import { NextRequest, NextResponse } from 'next/server';

import type { EthereumTxParams } from '@/lib/services/cross-chain-orchestrator';
import { initializeRelayerSetup } from '@/lib/utils/relayer-setup';

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
  transactionParams: EthereumTxParams,
) {
  try {
    // Initialize all relayer infrastructure with common setup
    const { orchestrator } = await initializeRelayerSetup({
      operationName: 'WITHDRAW',
    });

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
