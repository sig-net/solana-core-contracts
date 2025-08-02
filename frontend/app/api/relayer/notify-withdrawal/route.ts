import { NextRequest, NextResponse } from 'next/server';
import { Connection, Keypair } from '@solana/web3.js';
import NodeWallet from '@coral-xyz/anchor/dist/esm/nodewallet.js';
import { ethers } from 'ethers';

import { BridgeContract } from '@/lib/contracts/bridge-contract';
import { ChainSignaturesContract } from '@/lib/contracts/chain-signatures-contract';
import type { ChainSignaturesSignature } from '@/lib/types/chain-signatures.types';

export async function POST(request: NextRequest) {
  try {
    const { requestId, erc20Address, transactionParams } = await request.json();

    if (!requestId || !erc20Address) {
      return NextResponse.json(
        { error: 'Missing required fields: requestId and erc20Address' },
        { status: 400 },
      );
    }

    if (!transactionParams) {
      return NextResponse.json(
        {
          error:
            'Missing transactionParams - required for exact transaction reconstruction',
        },
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

    // Phase 1: Wait for signature and submit to Ethereum immediately
    const { signature, ethereumTxHash, blockNumber, gasUsed } =
      await waitForSignatureAndSubmitToEthereum(
        chainSignaturesContract,
        bridgeContract,
        provider,
        requestId,
        erc20Address,
        transactionParams,
      );

    console.log(
      `[WITHDRAW_RELAYER] Phase 1 complete - Ethereum tx: ${ethereumTxHash} confirmed in block ${blockNumber}`,
    );

    // Phase 2: Complete on Solana (we already have the read response from Phase 1)
    console.log(
      `[WITHDRAW_RELAYER] Phase 2 starting - completing withdrawal on Solana`,
    );
    await completeWithdrawalOnSolana(
      bridgeContract,
      requestId,
      erc20Address,
      signature,
    );

    console.log('Withdrawal processing completed:', {
      requestId,
      erc20Address,
      ethereumTxHash,
      ethereumBlockNumber: blockNumber,
      gasUsed: gasUsed?.toString(),
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

interface SignatureAndTxHash {
  signature: ChainSignaturesSignature;
  ethereumTxHash: string;
  blockNumber?: number;
  gasUsed?: bigint;
}

async function waitForSignatureAndSubmitToEthereum(
  chainSignaturesContract: ChainSignaturesContract,
  bridgeContract: BridgeContract,
  provider: ethers.JsonRpcProvider,
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
): Promise<SignatureAndTxHash> {
  console.log(
    `[WITHDRAW_SIGNATURE] Starting signature-first flow - using EXACT transaction params from frontend`,
  );

  // Step 1: Wait for signature event only
  const signatureData = await waitForSignatureEvent(
    chainSignaturesContract,
    requestId,
  );

  console.log(
    `[WITHDRAW_SIGNATURE] Got signature for ${requestId}, using exact frontend transaction`,
  );

  // Step 2: Extract Ethereum signature
  let ethereumSignature;
  try {
    ethereumSignature = chainSignaturesContract.extractSignature(signatureData);
  } catch (sigError) {
    console.error(
      '[WITHDRAW_SIGNATURE] Failed to extract Ethereum signature:',
      sigError,
    );
    throw new Error(
      `Signature extraction failed: ${sigError instanceof Error ? sigError.message : 'Unknown error'}`,
    );
  }

  // Step 3: Use the EXACT transaction parameters from frontend (no reconstruction!)
  const exactTx = {
    type: transactionParams.type,
    chainId: transactionParams.chainId,
    nonce: transactionParams.nonce,
    maxPriorityFeePerGas: BigInt(transactionParams.maxPriorityFeePerGas),
    maxFeePerGas: BigInt(transactionParams.maxFeePerGas),
    gasLimit: BigInt(transactionParams.gasLimit),
    to: transactionParams.to,
    value: BigInt(transactionParams.value),
    data: transactionParams.data,
  };

  console.log(
    `[WITHDRAW_SIGNATURE] Using exact frontend transaction with nonce ${exactTx.nonce}`,
  );

  // Log transaction details for debugging
  console.log('[WITHDRAW_SIGNATURE] Transaction details:', {
    type: exactTx.type,
    chainId: exactTx.chainId,
    nonce: exactTx.nonce,
    maxPriorityFeePerGas: exactTx.maxPriorityFeePerGas.toString(),
    maxFeePerGas: exactTx.maxFeePerGas.toString(),
    gasLimit: exactTx.gasLimit.toString(),
    to: exactTx.to,
    value: exactTx.value.toString(),
    dataLength: exactTx.data.length,
  });

  // Log signature details for debugging
  console.log('[WITHDRAW_SIGNATURE] Signature details:', {
    r: ethereumSignature.r,
    s: ethereumSignature.s,
    v: Number(ethereumSignature.v),
  });

  // Create signed transaction
  let signedTx;
  try {
    signedTx = ethers.Transaction.from({
      ...exactTx,
      signature: {
        r: ethereumSignature.r,
        s: ethereumSignature.s,
        v: Number(ethereumSignature.v),
      },
    });

    // Validate the signed transaction
    console.log('[WITHDRAW_SIGNATURE] Signed transaction created:', {
      hash: signedTx.hash,
      from: signedTx.from,
      to: signedTx.to,
      serialized: signedTx.serialized.substring(0, 100) + '...',
    });

    // Verify the transaction is properly signed
    if (!signedTx.from) {
      throw new Error('Transaction signature invalid - cannot recover sender');
    }

    // Additional validation
    if (!signedTx.hash || signedTx.hash === '0x') {
      throw new Error('Transaction hash is invalid');
    }

    if (!signedTx.serialized || signedTx.serialized.length < 10) {
      throw new Error('Serialized transaction is invalid');
    }
  } catch (signError) {
    console.error(
      '[WITHDRAW_SIGNATURE] Failed to create signed transaction:',
      signError,
    );
    throw new Error(
      `Signed transaction creation failed: ${signError instanceof Error ? signError.message : 'Unknown error'}`,
    );
  }

  // Step 4: Validate transaction before broadcasting
  try {
    console.log(
      '[WITHDRAW_SIGNATURE] Validating transaction before broadcast...',
    );

    // Try to estimate gas to validate the transaction
    const gasEstimate = await provider.estimateGas({
      from: signedTx.from,
      to: signedTx.to,
      data: signedTx.data,
      value: signedTx.value,
    });

    console.log('[WITHDRAW_SIGNATURE] Gas estimation successful:', {
      estimated: gasEstimate.toString(),
      provided: signedTx.gasLimit.toString(),
    });

    if (gasEstimate > signedTx.gasLimit) {
      console.warn('[WITHDRAW_SIGNATURE] Gas limit might be insufficient:', {
        estimated: gasEstimate.toString(),
        provided: signedTx.gasLimit.toString(),
      });
    }
  } catch (estimateError) {
    console.error('[WITHDRAW_SIGNATURE] Gas estimation failed:', estimateError);
    console.warn(
      '[WITHDRAW_SIGNATURE] Transaction might fail, but proceeding anyway...',
    );
  }

  // Step 5: Submit transaction to Ethereum and wait for confirmation
  let txResponse;
  let txReceipt;
  try {
    console.log('[WITHDRAW_SIGNATURE] About to broadcast transaction:', {
      serializedTx: signedTx.serialized,
      expectedHash: signedTx.hash,
      from: signedTx.from,
      to: signedTx.to,
      nonce: signedTx.nonce,
    });

    txResponse = await provider.broadcastTransaction(signedTx.serialized);
    console.log(
      `[WITHDRAW_SIGNATURE] Ethereum transaction submitted: ${txResponse.hash}`,
    );

    // Verify the hash matches what we expected
    if (txResponse.hash !== signedTx.hash) {
      console.warn('[WITHDRAW_SIGNATURE] Transaction hash mismatch:', {
        expected: signedTx.hash,
        actual: txResponse.hash,
      });
    }

    // Wait for confirmation to ensure the transaction succeeded
    console.log(`[WITHDRAW_SIGNATURE] Waiting for transaction confirmation...`);

    // Use a timeout for confirmation to avoid infinite waiting
    const confirmationTimeout = 5 * 60 * 1000; // 5 minutes
    const confirmationPromise = txResponse.wait();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('Transaction confirmation timeout')),
        confirmationTimeout,
      ),
    );

    txReceipt = await Promise.race([confirmationPromise, timeoutPromise]);

    if (!txReceipt) {
      throw new Error('Transaction receipt is null');
    }

    if (txReceipt.status !== 1) {
      throw new Error(`Transaction failed with status: ${txReceipt.status}`);
    }

    console.log(
      `[WITHDRAW_SIGNATURE] Ethereum transaction confirmed in block ${txReceipt.blockNumber}: ${txResponse.hash}`,
    );
    console.log(
      `[WITHDRAW_SIGNATURE] Gas used: ${txReceipt.gasUsed}/${txReceipt.gasLimit}`,
    );
  } catch (ethError) {
    console.error('[WITHDRAW_SIGNATURE] Ethereum transaction failed:', {
      error: ethError instanceof Error ? ethError.message : 'Unknown error',
      txHash: txResponse?.hash,
      blockNumber: txReceipt?.blockNumber,
      status: txReceipt?.status,
    });
    throw new Error(
      `Ethereum transaction failed: ${ethError instanceof Error ? ethError.message : 'Unknown error'}`,
    );
  }

  return {
    signature: signatureData,
    ethereumTxHash: txResponse.hash,
    blockNumber: txReceipt.blockNumber,
    gasUsed: txReceipt.gasUsed,
  };
}

async function waitForSignatureEvent(
  chainSignaturesContract: ChainSignaturesContract,
  requestId: string,
): Promise<ChainSignaturesSignature> {
  let signatureData = null;
  const maxAttempts = 60;
  let pollingInterval = 5000;
  let consecutiveFailures = 0;

  console.log(
    `[WITHDRAW_SIGNATURE] Waiting for signature event for ${requestId}`,
  );

  for (let i = 0; i < maxAttempts; i++) {
    try {
      signatureData =
        await chainSignaturesContract.findSignatureEventInLogs(requestId);
      if (signatureData) {
        console.log(
          `[WITHDRAW_SIGNATURE] Signature event found on attempt ${i + 1}`,
        );
        return signatureData;
      }

      consecutiveFailures = 0;
      pollingInterval = Math.min(pollingInterval * 1.05, 15000);
    } catch (pollError) {
      console.warn(
        `[WITHDRAW_SIGNATURE] Error during polling attempt ${i + 1}:`,
        pollError,
      );
      consecutiveFailures++;

      if (consecutiveFailures >= 3) {
        pollingInterval = Math.min(pollingInterval * 2, 30000);
        consecutiveFailures = 0;
      }
    }

    if (i < maxAttempts - 1) {
      const nextPollTime = Math.round(pollingInterval / 1000);
      console.log(
        `[WITHDRAW_SIGNATURE] Signature attempt ${i + 1}/${maxAttempts}, checking again in ${nextPollTime}s...`,
      );
      await new Promise(resolve => setTimeout(resolve, pollingInterval));
    }
  }

  throw new Error(`Signature event not found within timeout for ${requestId}`);
}

async function completeWithdrawalOnSolana(
  bridgeContract: BridgeContract,
  requestId: string,
  erc20Address: string,
  signatureData: ChainSignaturesSignature,
): Promise<void> {
  // We need to get the read response again for the serialized output
  // In a more sophisticated implementation, we'd pass this from Phase 1
  console.log(
    `[WITHDRAW_COMPLETE] Getting read response for Solana completion`,
  );

  // For now, we'll wait a bit for the read response to be available
  let readEvent = null;
  const maxAttempts = 10; // Reduced since it should be available quickly
  let pollingInterval = 2000; // Start with 2 seconds

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const chainSignaturesContract = new ChainSignaturesContract(
        bridgeContract['connection'],
        bridgeContract['wallet'],
      );

      readEvent =
        await chainSignaturesContract.findReadResponseEventInLogs(requestId);
      if (readEvent) {
        console.log(
          `[WITHDRAW_COMPLETE] Read response found for Solana completion`,
        );
        break;
      }
    } catch (pollError) {
      console.warn(
        `[WITHDRAW_COMPLETE] Error getting read response:`,
        pollError,
      );
    }

    if (i < maxAttempts - 1) {
      console.log(
        `[WITHDRAW_COMPLETE] Read response not ready, waiting ${pollingInterval}ms...`,
      );
      await new Promise(resolve => setTimeout(resolve, pollingInterval));
      pollingInterval = Math.min(pollingInterval * 1.2, 5000); // Max 5 seconds
    }
  }

  if (!readEvent) {
    throw new Error(
      `Read response not available for Solana completion: ${requestId}`,
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

  // Convert signature format for Solana
  const convertedSignature = {
    bigR: {
      x: Array.from(signatureData.bigR.x),
      y: Array.from(signatureData.bigR.y),
    },
    s: Array.from(signatureData.s),
    recoveryId: signatureData.recoveryId,
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

    console.log(
      `[WITHDRAW_COMPLETE] Solana withdrawal completion successful for request ${requestId}`,
    );
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
