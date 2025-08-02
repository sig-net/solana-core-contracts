import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import NodeWallet from '@coral-xyz/anchor/dist/esm/nodewallet.js';
import { ethers } from 'ethers';

import { BridgeContract } from '@/lib/contracts/bridge-contract';
import { ChainSignaturesContract } from '@/lib/contracts/chain-signatures-contract';
import { generateRequestId, evmParamsToProgram } from '@/lib/program/utils';
import { SERVICE_CONFIG } from '@/lib/constants/service.config';
import { HARDCODED_RECIPIENT_ADDRESS } from '@/lib/constants/ethereum.constants';
import { AlchemyService } from '@/lib/services/alchemy-service';

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
      if (!ethers.isAddress(erc20Address) || !ethers.isAddress(ethereumAddress)) {
        throw new Error('Invalid Ethereum address');
      }
    } catch (error) {
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

    // Get Alchemy instance for Ethereum operations
    const alchemy = AlchemyService.getInstance();
    
    // Also keep ethers provider for transaction operations
    const provider = new ethers.JsonRpcProvider(
      `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
    );

    // Monitor Ethereum for the deposit and get actual deposited amount
    const userPublicKey = new PublicKey(userAddress);
    const [vaultAuthority] =
      bridgeContract.deriveVaultAuthorityPda(userPublicKey);

    await new Promise(resolve => setTimeout(resolve, 12000));

    const actualAmount = await monitorTokenBalance(
      ethereumAddress,
      erc20Address,
      alchemy,
    );

    if (!actualAmount) {
      console.error('No token balance detected within timeout for deposit:', {
        userAddress,
        erc20Address,
        ethereumAddress,
      });
      return;
    }

    // Subtract a small random amount to avoid PDA collisions
    const randomReduction = BigInt(Math.floor(Math.random() * 100) + 1); // 1-100 wei
    const processAmount = actualAmount - randomReduction;

    const path = userAddress;
    const erc20AddressBytes = bridgeContract.erc20AddressToBytes(erc20Address);

    const callData = new ethers.Interface([
      'function transfer(address to, uint256 amount) returns (bool)',
    ]).encodeFunctionData('transfer', [
      HARDCODED_RECIPIENT_ADDRESS,
      processAmount,
    ]);

    const currentNonce = await AlchemyService.getTransactionCount(ethereumAddress, alchemy);

    const feeData = await AlchemyService.getFeeData(alchemy);
    const gasEstimate = await AlchemyService.estimateGas({
      to: erc20Address,
      from: ethereumAddress,
      data: callData,
      value: 0,
    }, alchemy);

    const tempTx = {
      type: 2,
      chainId: SERVICE_CONFIG.ETHEREUM.CHAIN_ID,
      nonce: currentNonce,
      maxPriorityFeePerGas:
        feeData.maxPriorityFeePerGas || ethers.parseUnits('2', 'gwei'),
      maxFeePerGas: feeData.maxFeePerGas || ethers.parseUnits('20', 'gwei'),
      gasLimit: (BigInt(gasEstimate) * BigInt(120)) / BigInt(100), // Add 20% buffer
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

    // Call deposit_erc20 (permissionless)
    await bridgeContract.depositErc20({
      requester: userPublicKey,
      payer: relayerWallet.publicKey,
      requestIdBytes,
      erc20AddressBytes,
      amount: amountBN,
      evmParams,
    });

    await waitForSignatureExecuteAndClaim(
      chainSignaturesContract,
      bridgeContract,
      provider,
      requestId,
      tempTx,
    );

    console.log('Deposit processing completed:', {
      userAddress,
      requestId,
      actualAmount: actualAmount.toString(),
      processedAmount: processAmount.toString(),
    });
  } catch (error) {
    console.error('Background deposit processing failed:', {
      userAddress,
      erc20Address,
      ethereumAddress,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

async function monitorTokenBalance(
  address: string,
  tokenAddress: string,
  alchemy?: any,
  timeoutMs = 300000, // 5 minutes
  pollIntervalMs = 5000, // 5 seconds
): Promise<bigint | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      // Use AlchemyService to get token balance
      const balance = await AlchemyService.getTokenBalance(address, tokenAddress, alchemy);

      if (balance && BigInt(balance) > BigInt(0)) {
        return BigInt(balance);
      }
    } catch (error) {
      console.error('Error fetching token balance:', error);
      // Continue polling on error
    }

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  return null;
}

async function waitForSignatureExecuteAndClaim(
  chainSignaturesContract: ChainSignaturesContract,
  bridgeContract: BridgeContract,
  provider: ethers.JsonRpcProvider,
  requestId: string,
  tempTx: ethers.TransactionRequest,
): Promise<void> {
  let signatureEvent = null;
  const maxSignatureAttempts = 60;

  for (let i = 0; i < maxSignatureAttempts; i++) {
    try {
      const events =
        await chainSignaturesContract.findSignatureEventInLogs(requestId);
      if (events) {
        signatureEvent = events;
        break;
      }
    } catch {
      // Continue polling
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  if (!signatureEvent) {
    throw new Error('Signature event not found within timeout');
  }

  const ethereumSignature =
    chainSignaturesContract.extractSignature(signatureEvent);

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
  let readEvent = null;
  const maxReadAttempts = 60; // 5 minutes with 5-second intervals

  for (let i = 0; i < maxReadAttempts; i++) {
    try {
      readEvent =
        await chainSignaturesContract.findReadResponseEventInLogs(requestId);
      if (readEvent) break;
    } catch {
      // Continue polling
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  if (!readEvent) {
    throw new Error('Read response event not found within timeout');
  }

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
}
