import { NextRequest, NextResponse } from 'next/server';
import { Connection, Keypair } from '@solana/web3.js';
import NodeWallet from '@coral-xyz/anchor/dist/esm/nodewallet.js';

import { BridgeContract } from '@/lib/contracts/bridge-contract';
import { ChainSignaturesContract } from '@/lib/contracts/chain-signatures-contract';

export async function POST(request: NextRequest) {
  try {
    const { userAddress, requestId, erc20Address, amount, recipient } =
      await request.json();

    if (!userAddress || !requestId || !erc20Address || !amount || !recipient) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    // Set up relayer wallet and contracts
    const connection = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL!);
    const relayerKeypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(process.env.RELAYER_PRIVATE_KEY!)),
    );
    const relayerWallet = new NodeWallet(relayerKeypair);

    const bridgeContract = new BridgeContract(connection, relayerWallet);
    const chainSignaturesContract = new ChainSignaturesContract(
      connection,
      relayerWallet,
    );

    console.log(
      `Relayer processing withdrawal: ${amount} ${erc20Address} to ${recipient} for user ${userAddress}, requestId: ${requestId}`,
    );

    // Wait for read response event and complete withdrawal
    await waitForReadResponseAndCompleteWithdrawal(
      chainSignaturesContract,
      bridgeContract,
      requestId,
      erc20Address,
    );

    return NextResponse.json({
      success: true,
      requestId,
      completedBy: relayerWallet.publicKey.toString(),
    });
  } catch (error) {
    console.error('Relayer withdrawal processing failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}

async function waitForReadResponseAndCompleteWithdrawal(
  chainSignaturesContract: ChainSignaturesContract,
  bridgeContract: BridgeContract,
  requestId: string,
  erc20Address: string,
): Promise<void> {
  // Wait for read response event
  let readEvent = null;
  const maxAttempts = 120; // 10 minutes with 5-second intervals

  for (let i = 0; i < maxAttempts; i++) {
    try {
      readEvent =
        await chainSignaturesContract.findReadResponseEventInLogs(requestId);
      if (readEvent) break;
    } catch (error) {
      console.error('Error checking for read response:', error);
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  if (!readEvent) {
    throw new Error('Read response event not found within timeout');
  }

  // Get pending withdrawal details
  const requestIdBytes = bridgeContract.hexToBytes(requestId);
  const [pendingWithdrawalPda] =
    bridgeContract.derivePendingWithdrawalPda(requestIdBytes);

  let pendingWithdrawal;
  try {
    pendingWithdrawal =
      await bridgeContract.fetchPendingWithdrawal(pendingWithdrawalPda);
  } catch {
    throw new Error(`No pending withdrawal found for request ID ${requestId}`);
  }

  // Convert signature format
  const convertedSignature = {
    bigR: {
      x: Array.from(readEvent.signature.bigR.x),
      y: Array.from(readEvent.signature.bigR.y),
    },
    s: Array.from(readEvent.signature.s),
    recoveryId: readEvent.signature.recoveryId,
  };

  const erc20AddressBytes = bridgeContract.hexToBytes(erc20Address);

  // Call complete_withdraw_erc20 (permissionless)
  await bridgeContract.completeWithdrawErc20({
    requester: pendingWithdrawal.requester,
    requestIdBytes,
    serializedOutput: readEvent.serializedOutput,
    signature: convertedSignature,
    erc20AddressBytes,
  });

  console.log(`Withdrawal completed for requestId: ${requestId}`);
}
