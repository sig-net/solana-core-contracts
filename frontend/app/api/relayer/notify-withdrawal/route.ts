import { NextRequest, NextResponse } from 'next/server';
import { Keypair } from '@solana/web3.js';
import NodeWallet from '@coral-xyz/anchor/dist/esm/nodewallet.js';
import { ethers } from 'ethers';

import { BridgeContract } from '@/lib/contracts/bridge-contract';
import { ChainSignaturesContract } from '@/lib/contracts/chain-signatures-contract';
import type { ChainSignaturesSignature } from '@/lib/types/chain-signatures.types';
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
    // Get validated environment variables
    const env = getFullEnv();

    // Get providers
    const connection = getSolanaConnection();
    const provider = getEthereumProvider();

    // Set up relayer wallet
    const relayerKeypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(env.RELAYER_PRIVATE_KEY)),
    );
    const relayerWallet = new NodeWallet(relayerKeypair);

    // Initialize contracts
    const bridgeContract = new BridgeContract(connection, relayerWallet);
    const chainSignaturesContract = new ChainSignaturesContract(
      connection,
      relayerWallet,
    );

    const { signature, ethereumTxHash } =
      await waitForSignatureAndSubmitToEthereum(
        chainSignaturesContract,
        provider,
        requestId,
        transactionParams,
      );

    console.log(`[WITHDRAW] Ethereum tx: ${ethereumTxHash}`);

    const solanaTxHash = await completeWithdrawalOnSolana(
      bridgeContract,
      requestId,
      erc20Address,
      signature,
    );

    console.log(`[WITHDRAW] Solana tx: ${solanaTxHash}`);
    console.log(`[WITHDRAW] Withdrawal completed successfully`);
  } catch (error) {
    console.error('[WITHDRAW] Processing failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

interface SignatureAndTxHash {
  signature: ChainSignaturesSignature;
  ethereumTxHash: string;
}

async function waitForSignatureAndSubmitToEthereum(
  chainSignaturesContract: ChainSignaturesContract,
  provider: ethers.JsonRpcProvider,
  requestId: string,
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
  console.log(`[WITHDRAW] Waiting for signature...`);

  const signatureData = await waitForSignatureEvent(
    chainSignaturesContract,
    requestId,
  );

  console.log(`[WITHDRAW] Signature received`);

  const ethereumSignature =
    chainSignaturesContract.extractSignature(signatureData);

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

  console.log(`[WITHDRAW] Submitting to Ethereum...`);

  const signedTx = ethers.Transaction.from({
    ...exactTx,
    signature: {
      r: ethereumSignature.r,
      s: ethereumSignature.s,
      v: Number(ethereumSignature.v),
    },
  });

  const txResponse = await provider.broadcastTransaction(signedTx.serialized);
  const txReceipt = await txResponse.wait();

  if (txReceipt?.status !== 1) {
    throw new Error(`Transaction failed with status: ${txReceipt?.status}`);
  }

  return {
    signature: signatureData,
    ethereumTxHash: txResponse.hash,
  };
}

async function waitForSignatureEvent(
  chainSignaturesContract: ChainSignaturesContract,
  requestId: string,
): Promise<ChainSignaturesSignature> {
  const eventPromises = chainSignaturesContract.setupEventListeners(requestId);

  try {
    const signatureEvent = await eventPromises.signature;
    return signatureEvent.signature;
  } finally {
    eventPromises.cleanup();
  }
}

async function completeWithdrawalOnSolana(
  bridgeContract: BridgeContract,
  requestId: string,
  erc20Address: string,
  signatureData: ChainSignaturesSignature,
): Promise<string> {
  console.log(`[WITHDRAW] Completing on Solana...`);

  const chainSignaturesContract = new ChainSignaturesContract(
    bridgeContract['connection'],
    bridgeContract['wallet'],
  );

  const eventPromises = chainSignaturesContract.setupEventListeners(requestId);

  let readEvent;
  try {
    readEvent = await eventPromises.readRespond;
  } finally {
    eventPromises.cleanup();
  }

  const requestIdBytes = bridgeContract.hexToBytes(requestId);
  const [pendingWithdrawalPda] =
    bridgeContract.derivePendingWithdrawalPda(requestIdBytes);

  const pendingWithdrawal =
    await bridgeContract.fetchPendingWithdrawal(pendingWithdrawalPda);

  const convertedSignature = {
    bigR: {
      x: Array.from(signatureData.bigR.x),
      y: Array.from(signatureData.bigR.y),
    },
    s: Array.from(signatureData.s),
    recoveryId: signatureData.recoveryId,
  };

  const erc20AddressBytes = bridgeContract.hexToBytes(erc20Address);

  const solanaTxHash = await bridgeContract.completeWithdrawErc20({
    requester: pendingWithdrawal.requester,
    requestIdBytes,
    serializedOutput: readEvent.serializedOutput,
    signature: convertedSignature,
    erc20AddressBytes,
  });

  return solanaTxHash;
}
