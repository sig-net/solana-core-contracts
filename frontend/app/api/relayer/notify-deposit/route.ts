import { NextRequest, NextResponse } from 'next/server';
import { PublicKey, Keypair } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import NodeWallet from '@coral-xyz/anchor/dist/esm/nodewallet.js';
import { ethers } from 'ethers';

import {
  CrossChainOrchestrator,
  type EthereumTxParams,
} from '@/lib/services/cross-chain-orchestrator';
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
      { operationName: 'DEPOSIT' },
    );
    const bridgeContract = orchestrator.getBridgeContract();

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

    const randomReduction = BigInt(Math.floor(Math.random() * 100) + 1);
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
      gasLimit: (gasEstimate * BigInt(120)) / BigInt(100),
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

    const result = await orchestrator.executeSignatureFlow(
      requestId,
      tempTx as EthereumTxParams,
      async readEvent => {
        const requestIdBytes = bridgeContract.hexToBytes(requestId);
        const [pendingDepositPda] =
          bridgeContract.derivePendingDepositPda(requestIdBytes);
        const pendingDeposit =
          await bridgeContract.fetchPendingDeposit(pendingDepositPda);

        return await bridgeContract.claimErc20({
          requester: pendingDeposit.requester,
          requestIdBytes,
          serializedOutput: readEvent.serializedOutput,
          signature: readEvent.signature,
          erc20AddressBytes: pendingDeposit.erc20Address,
        });
      },
      // Initial Solana transaction (optional 4th parameter)
      async () => {
        console.log('[DEPOSIT] Creating Solana deposit...');
        return await bridgeContract.depositErc20({
          requester: userPublicKey,
          payer: relayerWallet.publicKey,
          requestIdBytes,
          erc20AddressBytes,
          amount: amountBN,
          evmParams,
        });
      },
    );

    if (result.success) {
      console.log(`[DEPOSIT] Deposit tx: ${result.initialSolanaTxHash}`);
      console.log(`[DEPOSIT] Ethereum tx: ${result.ethereumTxHash}`);
      console.log(`[DEPOSIT] Claim tx: ${result.solanaResult}`);
      console.log('[DEPOSIT] Deposit completed successfully');
    } else {
      throw new Error(result.error || 'Deposit failed');
    }
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
  timeoutMs = 300000,
  initialPollIntervalMs = 10000,
): Promise<bigint | null> {
  const startTime = Date.now();
  let pollIntervalMs = initialPollIntervalMs;
  let consecutiveFailures = 0;
  const maxConsecutiveFailures = 3;

  const erc20Contract = new ethers.Contract(
    tokenAddress,
    ['function balanceOf(address owner) view returns (uint256)'],
    provider,
  );

  while (Date.now() - startTime < timeoutMs) {
    try {
      const balance = await erc20Contract.balanceOf(address);

      if (balance > BigInt(0)) {
        console.log(`[DEPOSIT] Token balance detected`);
        return balance;
      }

      consecutiveFailures = 0;

      pollIntervalMs = Math.min(pollIntervalMs * 1.1, 30000);
    } catch (error) {
      console.error('Error fetching token balance:', error);
      consecutiveFailures++;

      if (consecutiveFailures >= maxConsecutiveFailures) {
        pollIntervalMs = Math.min(pollIntervalMs * 2, 60000);
        consecutiveFailures = 0;
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
