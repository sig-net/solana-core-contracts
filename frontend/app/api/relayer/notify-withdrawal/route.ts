import { NextRequest, NextResponse } from 'next/server';
import { Connection, Keypair } from '@solana/web3.js';
import NodeWallet from '@coral-xyz/anchor/dist/esm/nodewallet.js';
import { ethers } from 'ethers';

import { BridgeContract } from '@/lib/contracts/bridge-contract';
import { ChainSignaturesContract } from '@/lib/contracts/chain-signatures-contract';

export async function POST(request: NextRequest) {
  try {
    const { requestId, erc20Address } = await request.json();

    if (!requestId || !erc20Address) {
      return NextResponse.json(
        { error: 'Missing required fields: requestId and erc20Address' },
        { status: 400 },
      );
    }

    // Validate addresses
    try {
      if (!ethers.isAddress(erc20Address)) {
        throw new Error('Invalid ERC20 address');
      }
      // Basic hex validation for requestId
      if (!/^0x[a-fA-F0-9]+$/.test(requestId)) {
        throw new Error('Invalid request ID format');
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400 },
      );
    }

    // Return success immediately and process in background
    processWithdrawalInBackground(requestId, erc20Address);

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
) {
  try {
    // Set up relayer wallet and contracts
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    if (!rpcUrl) {
      console.error(
        '[WITHDRAW_RELAYER] Missing NEXT_PUBLIC_SOLANA_RPC_URL environment variable',
      );
      return;
    }

    const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY;
    if (!relayerPrivateKey) {
      console.error(
        '[WITHDRAW_RELAYER] Missing RELAYER_PRIVATE_KEY environment variable',
      );
      return;
    }

    const connection = new Connection(rpcUrl);

    const relayerKeypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(relayerPrivateKey)),
    );
    const relayerWallet = new NodeWallet(relayerKeypair);

    const bridgeContract = new BridgeContract(connection, relayerWallet);
    const chainSignaturesContract = new ChainSignaturesContract(
      connection,
      relayerWallet,
    );

    // Set up Alchemy provider for Ethereum operations
    const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
    if (!alchemyKey) {
      console.error(
        '[WITHDRAW_RELAYER] Missing NEXT_PUBLIC_ALCHEMY_API_KEY environment variable',
      );
      return;
    }

    const alchemyUrl = `https://eth-sepolia.g.alchemy.com/v2/${alchemyKey}`;
    const provider = new ethers.JsonRpcProvider(alchemyUrl);

    await waitForReadResponseAndCompleteWithdrawal(
      chainSignaturesContract,
      bridgeContract,
      provider,
      requestId,
      erc20Address,
    );

    console.log('Withdrawal processing completed:', {
      requestId,
      erc20Address,
      completedBy: relayerWallet.publicKey.toString(),
    });
  } catch (error) {
    console.error('Background withdrawal processing failed:', {
      requestId,
      erc20Address,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

async function waitForReadResponseAndCompleteWithdrawal(
  chainSignaturesContract: ChainSignaturesContract,
  bridgeContract: BridgeContract,
  provider: ethers.JsonRpcProvider,
  requestId: string,
  erc20Address: string,
): Promise<void> {
  // Wait for read response event
  let readEvent = null;
  const maxAttempts = 60; // Reduced from 120 (was 10 minutes, now ~8 minutes with adaptive polling)
  let pollingInterval = 10000; // Start with 10 seconds instead of 5
  let consecutiveFailures = 0;

  console.log(
    `[WITHDRAW_COMPLETE] Waiting for read response event for request ${requestId}`,
  );

  for (let i = 0; i < maxAttempts; i++) {
    try {
      readEvent =
        await chainSignaturesContract.findReadResponseEventInLogs(requestId);
      if (readEvent) {
        console.log(
          `[WITHDRAW_COMPLETE] Read response event found on attempt ${i + 1}`,
        );
        break;
      }

      // Reset failure count on successful call
      consecutiveFailures = 0;

      // Gradually increase polling interval to reduce API calls
      pollingInterval = Math.min(pollingInterval * 1.05, 25000); // Max 25 seconds
    } catch (pollError) {
      console.warn(
        `[WITHDRAW_COMPLETE] Error during polling attempt ${i + 1}:`,
        pollError,
      );
      consecutiveFailures++;

      // Increase interval after failures to avoid hammering the API
      if (consecutiveFailures >= 3) {
        pollingInterval = Math.min(pollingInterval * 2, 45000); // Max 45 seconds
        consecutiveFailures = 0; // Reset to prevent exponential growth
      }
    }

    if (i < maxAttempts - 1) {
      const nextPollTime = Math.round(pollingInterval / 1000);
      console.log(
        `[WITHDRAW_COMPLETE] Attempt ${i + 1}/${maxAttempts}, checking again in ${nextPollTime}s...`,
      );
      await new Promise(resolve => setTimeout(resolve, pollingInterval));
    }
  }

  if (!readEvent) {
    const timeoutDuration = (maxAttempts * pollingInterval) / 1000;
    console.error('[WITHDRAW_COMPLETE] Read response event timeout:', {
      requestId,
      maxAttempts,
      timeoutSeconds: timeoutDuration,
    });
    throw new Error(
      `Read response event not found within timeout (${timeoutDuration}s)`,
    );
  }

  // Extract Ethereum signature and submit withdrawal transaction
  let ethereumSignature;
  try {
    ethereumSignature = chainSignaturesContract.extractSignature(
      readEvent.signature,
    );
  } catch (sigError) {
    console.error(
      '[WITHDRAW_COMPLETE] Failed to extract Ethereum signature:',
      sigError,
    );
    throw new Error(
      `Signature extraction failed: ${sigError instanceof Error ? sigError.message : 'Unknown error'}`,
    );
  }

  // Get the transaction details from readEvent.serializedOutput
  let tempTx;
  try {
    tempTx = ethers.Transaction.from(
      ethers.hexlify(new Uint8Array(readEvent.serializedOutput)),
    );
  } catch (parseError) {
    console.error(
      '[WITHDRAW_COMPLETE] Failed to parse transaction:',
      parseError,
    );
    throw new Error(
      `Transaction parsing failed: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
    );
  }

  // Create signed transaction
  let signedTx;
  try {
    signedTx = ethers.Transaction.from({
      type: tempTx.type,
      chainId: tempTx.chainId,
      nonce: tempTx.nonce,
      maxPriorityFeePerGas: tempTx.maxPriorityFeePerGas,
      maxFeePerGas: tempTx.maxFeePerGas,
      gasLimit: tempTx.gasLimit,
      to: tempTx.to as string,
      value: tempTx.value,
      data: tempTx.data as string,
      signature: {
        r: ethereumSignature.r,
        s: ethereumSignature.s,
        v: Number(ethereumSignature.v),
      },
    });
  } catch (signError) {
    console.error(
      '[WITHDRAW_COMPLETE] Failed to create signed transaction:',
      signError,
    );
    throw new Error(
      `Signed transaction creation failed: ${signError instanceof Error ? signError.message : 'Unknown error'}`,
    );
  }

  // Submit transaction to Ethereum
  let txResponse;
  let txReceipt;
  try {
    txResponse = await provider.broadcastTransaction(signedTx.serialized);

    txReceipt = await txResponse.wait();

    if (!txReceipt) {
      throw new Error('Transaction receipt is null');
    }
  } catch (ethError) {
    console.error('[WITHDRAW_COMPLETE] Ethereum transaction failed:', {
      error: ethError instanceof Error ? ethError.message : 'Unknown error',
      txHash: txResponse?.hash,
    });
    throw new Error(
      `Ethereum transaction failed: ${ethError instanceof Error ? ethError.message : 'Unknown error'}`,
    );
  }

  // Get pending withdrawal details
  const requestIdBytes = bridgeContract.hexToBytes(requestId);
  const [pendingWithdrawalPda] =
    bridgeContract.derivePendingWithdrawalPda(requestIdBytes);

  let pendingWithdrawal;
  try {
    pendingWithdrawal =
      await bridgeContract.fetchPendingWithdrawal(pendingWithdrawalPda);
  } catch (fetchError) {
    console.error('[WITHDRAW_COMPLETE] Failed to fetch pending withdrawal:', {
      requestId,
      pendingWithdrawalPda: pendingWithdrawalPda.toString(),
      error: fetchError instanceof Error ? fetchError.message : 'Unknown error',
    });
    throw new Error(
      `No pending withdrawal found for request ID ${requestId}: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`,
    );
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
  try {
    await bridgeContract.completeWithdrawErc20({
      requester: pendingWithdrawal.requester,
      requestIdBytes,
      serializedOutput: readEvent.serializedOutput,
      signature: convertedSignature,
      erc20AddressBytes,
    });
  } catch (completeError) {
    console.error(
      '[WITHDRAW_COMPLETE] Failed to complete withdrawal on Solana:',
      {
        requestId,
        error:
          completeError instanceof Error
            ? completeError.message
            : 'Unknown error',
        stack: completeError instanceof Error ? completeError.stack : undefined,
      },
    );
    throw new Error(
      `Solana withdrawal completion failed: ${completeError instanceof Error ? completeError.message : 'Unknown error'}`,
    );
  }
}
