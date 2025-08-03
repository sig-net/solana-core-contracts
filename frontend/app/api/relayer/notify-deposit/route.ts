import { NextRequest, NextResponse } from 'next/server';
import { PublicKey, Keypair } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import NodeWallet from '@coral-xyz/anchor/dist/esm/nodewallet.js';
import { ethers } from 'ethers';

import { BridgeContract } from '@/lib/contracts/bridge-contract';
import { ChainSignaturesContract } from '@/lib/contracts/chain-signatures-contract';
import { generateRequestId, evmParamsToProgram } from '@/lib/program/utils';
import { SERVICE_CONFIG } from '@/lib/constants/service.config';
import { VAULT_ETHEREUM_ADDRESS } from '@/lib/constants/addresses';
import { getFullEnv } from '@/lib/utils/env';
import {
  getSolanaConnection,
  getEthereumProvider,
} from '@/lib/utils/providers';

export async function POST(request: NextRequest) {
  try {
    const { userAddress, erc20Address, ethereumAddress } = await request.json();

    if (!userAddress || !erc20Address || !ethereumAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    // Validate addresses
    try {
      new PublicKey(userAddress);
      if (
        !ethers.isAddress(erc20Address) ||
        !ethers.isAddress(ethereumAddress)
      ) {
        throw new Error('Invalid Ethereum address');
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400 },
      );
    }

    // Return success immediately and process in background
    processDepositInBackground(userAddress, erc20Address, ethereumAddress);

    return NextResponse.json({
      success: true,
      message: 'Deposit monitoring started',
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

async function processDepositInBackground(
  userAddress: string,
  erc20Address: string,
  ethereumAddress: string,
) {
  try {
    // Get validated environment variables
    const env = getFullEnv();

    // Get providers
    const connection = getSolanaConnection();
    const provider = getEthereumProvider();

    // Set up relayer wallet and contracts
    const relayerKeypair = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(env.RELAYER_PRIVATE_KEY)),
    );
    const relayerWallet = new NodeWallet(relayerKeypair);

    const bridgeContract = new BridgeContract(connection, relayerWallet);
    const chainSignaturesContract = new ChainSignaturesContract(
      connection,
      relayerWallet,
    );

    // Monitor Ethereum for the deposit and get actual deposited amount
    const userPublicKey = new PublicKey(userAddress);
    const [vaultAuthority] =
      bridgeContract.deriveVaultAuthorityPda(userPublicKey);

    await new Promise(resolve => setTimeout(resolve, 12000));

    const actualAmount = await monitorTokenBalance(
      ethereumAddress,
      erc20Address,
      provider,
    );

    if (!actualAmount) {
      console.error('[DEPOSIT] No token balance detected within timeout');
      return;
    }

    // Subtract a small random amount to avoid PDA collisions
    const randomReduction = BigInt(Math.floor(Math.random() * 100) + 1); // 1-100 wei
    const processAmount = actualAmount - randomReduction;

    const path = userAddress;
    const erc20AddressBytes = bridgeContract.erc20AddressToBytes(erc20Address);

    const callData = new ethers.Interface([
      'function transfer(address to, uint256 amount) returns (bool)',
    ]).encodeFunctionData('transfer', [VAULT_ETHEREUM_ADDRESS, processAmount]);

    const currentNonce = await provider.getTransactionCount(ethereumAddress);

    const feeData = await provider.getFeeData();
    const gasEstimate = await provider.estimateGas({
      to: erc20Address,
      from: ethereumAddress,
      data: callData,
      value: BigInt(0),
    });

    const tempTx = {
      type: 2,
      chainId: SERVICE_CONFIG.ETHEREUM.CHAIN_ID,
      nonce: currentNonce,
      maxPriorityFeePerGas:
        feeData.maxPriorityFeePerGas || ethers.parseUnits('2', 'gwei'),
      maxFeePerGas: feeData.maxFeePerGas || ethers.parseUnits('20', 'gwei'),
      gasLimit: (gasEstimate * BigInt(120)) / BigInt(100), // Add 20% buffer
      to: erc20Address,
      value: BigInt(0),
      data: callData,
    };

    const rlpEncodedTx = ethers.Transaction.from(tempTx).unsignedSerialized;
    const requestId = generateRequestId(
      vaultAuthority,
      ethers.getBytes(rlpEncodedTx),
      SERVICE_CONFIG.ETHEREUM.SLIP44_COIN_TYPE,
      SERVICE_CONFIG.RETRY.DEFAULT_KEY_VERSION,
      path,
      SERVICE_CONFIG.CRYPTOGRAPHY.SIGNATURE_ALGORITHM,
      SERVICE_CONFIG.CRYPTOGRAPHY.TARGET_BLOCKCHAIN,
      '',
    );

    const requestIdBytes = bridgeContract.hexToBytes(requestId);
    const evmParams = evmParamsToProgram({
      value: tempTx.value,
      gasLimit: tempTx.gasLimit,
      maxFeePerGas: tempTx.maxFeePerGas,
      maxPriorityFeePerGas: tempTx.maxPriorityFeePerGas,
      nonce: BigInt(tempTx.nonce),
      chainId: BigInt(tempTx.chainId),
    });
    const amountBN = new BN(processAmount.toString());

    console.log('[DEPOSIT] Creating Solana deposit...');

    // Call deposit_erc20 (permissionless)
    const solanaTxHash = await bridgeContract.depositErc20({
      requester: userPublicKey,
      payer: relayerWallet.publicKey,
      requestIdBytes,
      erc20AddressBytes,
      amount: amountBN,
      evmParams,
    });

    console.log(`[DEPOSIT] Solana tx: ${solanaTxHash}`);

    const ethereumTxHash = await waitForSignatureExecuteAndClaim(
      chainSignaturesContract,
      bridgeContract,
      provider,
      requestId,
      tempTx,
    );

    console.log(`[DEPOSIT] Ethereum tx: ${ethereumTxHash}`);
    console.log('[DEPOSIT] Deposit completed successfully');
  } catch (error) {
    console.error('[DEPOSIT] Processing failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function monitorTokenBalance(
  address: string,
  tokenAddress: string,
  provider: ethers.JsonRpcProvider,
  timeoutMs = 300000, // 5 minutes
  initialPollIntervalMs = 10000, // Start with 10 seconds
): Promise<bigint | null> {
  const startTime = Date.now();
  let pollIntervalMs = initialPollIntervalMs;
  let consecutiveFailures = 0;
  const maxConsecutiveFailures = 3;

  // Create ERC20 contract instance
  const erc20Contract = new ethers.Contract(
    tokenAddress,
    ['function balanceOf(address owner) view returns (uint256)'],
    provider,
  );

  while (Date.now() - startTime < timeoutMs) {
    try {
      // Get token balance using ethers contract call
      const balance = await erc20Contract.balanceOf(address);

      if (balance > BigInt(0)) {
        console.log(`[DEPOSIT] Token balance detected`);
        return balance;
      }

      // Reset failure count on successful call
      consecutiveFailures = 0;

      // Gradually increase polling interval to reduce API calls
      pollIntervalMs = Math.min(pollIntervalMs * 1.1, 30000); // Max 30 seconds
    } catch (error) {
      console.error('Error fetching token balance:', error);
      consecutiveFailures++;

      // Increase interval after failures to avoid hammering the API
      if (consecutiveFailures >= maxConsecutiveFailures) {
        pollIntervalMs = Math.min(pollIntervalMs * 2, 60000); // Max 1 minute
        consecutiveFailures = 0; // Reset to prevent exponential growth
      }
    }

    const nextPollTime = Math.round(pollIntervalMs / 1000);
    console.log(
      `[DEPOSIT] No balance yet, checking again in ${nextPollTime}s...`,
    );
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  console.warn(`[DEPOSIT] Timeout reached after ${timeoutMs / 1000}s`);
  return null;
}

async function waitForSignatureExecuteAndClaim(
  chainSignaturesContract: ChainSignaturesContract,
  bridgeContract: BridgeContract,
  provider: ethers.JsonRpcProvider,
  requestId: string,
  tempTx: ethers.TransactionRequest,
): Promise<string> {
  console.log(`[DEPOSIT] Waiting for signature...`);

  // Setup event listeners instead of polling
  const eventPromises = chainSignaturesContract.setupEventListeners(requestId);

  try {
    // Wait for signature event
    const signatureEvent = await eventPromises.signature;
    console.log(`[DEPOSIT] Signature received`);

    const ethereumSignature = chainSignaturesContract.extractSignature(
      signatureEvent.signature,
    );

    console.log(`[DEPOSIT] Submitting to Ethereum...`);

    const signedTx = ethers.Transaction.from({
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

    const txResponse = await provider.broadcastTransaction(signedTx.serialized);
    await txResponse.wait();

    // Wait for read response event
    console.log(`[DEPOSIT] Completing on Solana...`);
    const readEvent = await eventPromises.readRespond;

    const requestIdBytes = bridgeContract.hexToBytes(requestId);
    const [pendingDepositPda] =
      bridgeContract.derivePendingDepositPda(requestIdBytes);
    const pendingDeposit =
      await bridgeContract.fetchPendingDeposit(pendingDepositPda);

    const convertedSignature = {
      bigR: {
        x: Array.from(readEvent.signature.bigR.x),
        y: Array.from(readEvent.signature.bigR.y),
      },
      s: Array.from(readEvent.signature.s),
      recoveryId: readEvent.signature.recoveryId,
    };

    await bridgeContract.claimErc20({
      requester: pendingDeposit.requester,
      requestIdBytes,
      serializedOutput: readEvent.serializedOutput,
      signature: convertedSignature,
      erc20AddressBytes: pendingDeposit.erc20Address,
    });

    return txResponse.hash;
  } finally {
    // Always cleanup event listeners
    eventPromises.cleanup();
  }
}
