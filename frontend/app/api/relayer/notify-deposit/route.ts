import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { ethers } from 'ethers';
import { toBytes } from 'viem';

import type { EvmTransactionRequest } from '@/lib/types/shared.types';
import { buildErc20TransferTx } from '@/lib/evm/tx-builder';
import { initializeRelayerSetup } from '@/lib/utils/relayer-setup';
import { generateRequestId, evmParamsToProgram } from '@/lib/program/utils';
import { SERVICE_CONFIG } from '@/lib/constants/service.config';
import {
  VAULT_ETHEREUM_ADDRESS,
  deriveVaultAuthorityPda,
  derivePendingDepositPda,
} from '@/lib/constants/addresses';

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

    // Fire-and-forget: accept duplicate calls; relayer flow is idempotent downstream
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
    // Initialize all relayer infrastructure with common setup
    const { orchestrator, provider, relayerWallet } =
      await initializeRelayerSetup({
        operationName: 'DEPOSIT',
        // Enforce 60s event timeout as requested
        eventTimeoutMs: 60000,
      });
    const bridgeContract = orchestrator.getBridgeContract();

    const userPublicKey = new PublicKey(userAddress);
    const [vaultAuthority] = deriveVaultAuthorityPda(userPublicKey);

    // Brief grace period to ensure any prior transactions or mempool updates propagate
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
    const processAmount =
      actualAmount > randomReduction
        ? actualAmount - randomReduction
        : actualAmount;

    const path = userAddress;
    const erc20AddressBytes = Array.from(toBytes(erc20Address));

    // Keep local callData for requestId parity logs if needed in future
    // encode calldata is handled in the shared builder

    const txRequest: EvmTransactionRequest = await buildErc20TransferTx({
      provider,
      from: ethereumAddress,
      erc20Address,
      recipient: VAULT_ETHEREUM_ADDRESS,
      amount: processAmount,
    });

    const rlpEncodedTx = ethers.Transaction.from(txRequest).unsignedSerialized;
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

    const requestIdBytes = Array.from(toBytes(requestId));
    const evmParams = evmParamsToProgram(txRequest);
    const amountBN = new BN(processAmount.toString());

    const result = await orchestrator.executeSignatureFlow(
      requestId,
      txRequest,
      async readEvent => {
        const requestIdBytes = Array.from(toBytes(requestId));
        const [pendingDepositPda] = derivePendingDepositPda(requestIdBytes);
        try {
          const pendingDeposit =
            await bridgeContract.fetchPendingDeposit(pendingDepositPda);

          return await bridgeContract.claimErc20({
            requester: pendingDeposit.requester,
            requestIdBytes,
            serializedOutput: readEvent.serializedOutput,
            signature: readEvent.signature,
            erc20AddressBytes: pendingDeposit.erc20Address,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (
            msg.includes('Account does not exist') ||
            msg.includes('AccountNotFound')
          ) {
            // Already claimed; treat as idempotent success
            return 'already-claimed';
          }
          throw e;
        }
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
  } finally {
    // no-op
  }
}

async function monitorTokenBalance(
  address: string,
  tokenAddress: string,
  provider: ethers.JsonRpcProvider,
): Promise<bigint | null> {
  const deadline = Date.now() + 60_000; // 1 minute
  const intervalMs = 5_000; // 5s fixed interval

  const erc20Contract = new ethers.Contract(
    tokenAddress,
    ['function balanceOf(address owner) view returns (uint256)'],
    provider,
  );

  while (Date.now() < deadline) {
    try {
      const balance = await erc20Contract.balanceOf(address);
      if (balance > BigInt(0)) return balance;
    } catch {
      console.warn('[DEPOSIT] balanceOf error, retrying...');
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  return null;
}
