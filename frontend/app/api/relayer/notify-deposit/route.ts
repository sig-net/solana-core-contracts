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

export async function POST(request: NextRequest) {
  try {
    const { userAddress, erc20Address, ethereumAddress } = await request.json();

    console.log({ userAddress, erc20Address, ethereumAddress });

    if (!userAddress || !erc20Address || !ethereumAddress) {
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

    // Set up Alchemy provider for Ethereum operations
    const provider = new ethers.JsonRpcProvider(
      `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
    );

    console.log(
      `Relayer monitoring deposit: ${erc20Address} from ${ethereumAddress} for user ${userAddress}`,
    );

    // Monitor Ethereum for the deposit and get actual deposited amount
    const userPublicKey = new PublicKey(userAddress);
    const [vaultAuthority] =
      bridgeContract.deriveVaultAuthorityPda(userPublicKey);

    // Start balance monitoring after initial delay
    console.log(
      `Starting balance monitoring for ${ethereumAddress} after 12s delay...`,
    );
    await new Promise(resolve => setTimeout(resolve, 12000)); // Wait 12 seconds

    const actualAmount = await monitorTokenBalance(
      provider,
      ethereumAddress,
      erc20Address,
    );

    if (!actualAmount) {
      return NextResponse.json(
        { error: 'No token balance detected within timeout' },
        { status: 408 },
      );
    }

    console.log(`Detected balance: ${actualAmount.toString()} tokens`);
    const depositTxHash = 'balance-detected';

    // Subtract a small random amount to avoid PDA collisions
    const randomReduction = BigInt(Math.floor(Math.random() * 100) + 1); // 1-100 wei
    const processAmount = actualAmount - randomReduction;
    console.log(
      `Processing amount (with random reduction): ${processAmount.toString()} tokens`,
    );

    // Call permissionless deposit_erc20
    const path = userAddress;
    const erc20AddressBytes = bridgeContract.erc20AddressToBytes(erc20Address);

    const transferInterface = new ethers.Interface([
      'function transfer(address to, uint256 amount) returns (bool)',
    ]);
    const callData = transferInterface.encodeFunctionData('transfer', [
      HARDCODED_RECIPIENT_ADDRESS,
      processAmount,
    ]);

    const currentNonce = await provider.getTransactionCount(ethereumAddress);

    // Get current network gas prices
    const feeData = await provider.getFeeData();

    // Estimate gas for the transaction
    const gasEstimate = await provider.estimateGas({
      to: erc20Address,
      from: ethereumAddress,
      data: callData,
      value: 0,
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

    // Call deposit_erc20 (permissionless)
    await bridgeContract.depositErc20({
      requester: userPublicKey,
      payer: relayerWallet.publicKey,
      requestIdBytes,
      erc20AddressBytes,
      amount: amountBN,
      evmParams,
    });

    // Wait for signature, execute EVM transaction, and call claim_erc20 (permissionless)
    await waitForSignatureExecuteAndClaim(
      chainSignaturesContract,
      bridgeContract,
      provider,
      requestId,
      tempTx,
      callData,
      erc20AddressBytes,
    );

    return NextResponse.json({
      success: true,
      requestId,
      depositTxHash,
      actualAmount: actualAmount.toString(),
      processedAmount: processAmount.toString(),
    });
  } catch (error) {
    console.error('Relayer deposit processing failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}

async function monitorTokenBalance(
  provider: ethers.JsonRpcProvider,
  address: string,
  tokenAddress: string,
  timeoutMs = 300000, // 5 minutes
  pollIntervalMs = 5000, // 5 seconds
): Promise<bigint | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      // Use ethers to call ERC20 balanceOf
      const contract = new ethers.Contract(
        tokenAddress,
        ['function balanceOf(address) view returns (uint256)'],
        provider,
      );

      const balance = await contract.balanceOf(address);

      if (balance > BigInt(0)) {
        console.log(
          `Found balance: ${balance.toString()} for address ${address}`,
        );
        return balance;
      }
    } catch (error) {
      console.error('Error checking token balance:', error);
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
  _callData: string,
  _erc20AddressBytes: number[],
): Promise<void> {
  // Step 1: Wait for signature from MPC network
  console.log('Waiting for signature from MPC network...');
  let signatureEvent = null;
  const maxSignatureAttempts = 60; // 5 minutes with 5-second intervals

  for (let i = 0; i < maxSignatureAttempts; i++) {
    try {
      const events =
        await chainSignaturesContract.findSignatureEventInLogs(requestId);
      if (events) {
        signatureEvent = events;
        break;
      }
    } catch (error) {
      console.error('Error checking for signature:', error);
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  if (!signatureEvent) {
    throw new Error('Signature event not found within timeout');
  }

  // Step 2: Extract signature and build signed transaction
  console.log('Building and submitting EVM transaction...');
  const ethereumSignature =
    chainSignaturesContract.extractSignature(signatureEvent);

  // Create signed transaction with proper signature format
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

  // Step 3: Submit transaction to Ethereum using Alchemy
  const txResponse = await provider.broadcastTransaction(signedTx.serialized);

  console.log(`EVM transaction submitted: ${txResponse.hash}`);

  // Step 4: Wait for Ethereum confirmation using Alchemy
  await txResponse.wait();

  console.log('EVM transaction confirmed, waiting for read response...');

  // Step 5: Wait for read response event
  let readEvent = null;
  const maxReadAttempts = 60; // 5 minutes with 5-second intervals

  for (let i = 0; i < maxReadAttempts; i++) {
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

  // Step 6: Get pending deposit details and call claim_erc20
  console.log('Calling claim_erc20...');
  const requestIdBytes = bridgeContract.hexToBytes(requestId);
  const [pendingDepositPda] =
    bridgeContract.derivePendingDepositPda(requestIdBytes);
  const pendingDeposit =
    await bridgeContract.fetchPendingDeposit(pendingDepositPda);

  // Convert signature format
  const convertedSignature = {
    bigR: {
      x: Array.from(readEvent.signature.bigR.x),
      y: Array.from(readEvent.signature.bigR.y),
    },
    s: Array.from(readEvent.signature.s),
    recoveryId: readEvent.signature.recoveryId,
  };

  // Call claim_erc20 (permissionless)
  await bridgeContract.claimErc20({
    requester: pendingDeposit.requester,
    requestIdBytes,
    serializedOutput: readEvent.serializedOutput,
    signature: convertedSignature,
    erc20AddressBytes: pendingDeposit.erc20Address,
  });

  console.log('Deposit flow completed successfully!');
}
