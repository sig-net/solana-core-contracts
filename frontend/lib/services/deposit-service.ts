import { PublicKey } from '@solana/web3.js';
import { BN, Wallet } from '@coral-xyz/anchor';
import { ethers } from 'ethers';
import type { PublicClient } from 'viem';

import {
  generateRequestId,
  createEvmTransactionParams,
  evmParamsToProgram,
} from '@/lib/program/utils';
import { getPublicClient } from '@/lib/viem/providers';
import { BridgeContract } from '@/lib/contracts/bridge-contract';
import { ChainSignaturesContract } from '@/lib/contracts/chain-signatures-contract';
import { CryptographyService } from '@/lib/services/cryptography-service';
import { TokenBalanceService } from '@/lib/services/token-balance-service';
import { EventOrchestrator } from '@/lib/services/event-orchestrator';
import type { EventPromises } from '@/lib/types/chain-signatures.types';
import type { EthereumTransaction } from '@/lib/types/ethereum.types';
import type { DepositStatusCallback } from '@/lib/types/shared.types';
import { CHAIN_SIGNATURES_CONFIG } from '@/lib/constants/chain-signatures.constants';
import {
  HARDCODED_RECIPIENT_ADDRESS,
  ETHEREUM_CONFIG,
} from '@/lib/constants/ethereum.constants';
import { SERVICE_CONFIG } from '@/lib/constants/service.config';

/**
 * DepositService handles all ERC20 deposit operations including
 * initiating deposits, processing the flow, and claiming tokens.
 */
export class DepositService {
  private eventOrchestrator: EventOrchestrator;

  constructor(
    private bridgeContract: BridgeContract,
    private chainSignaturesContract: ChainSignaturesContract,
    private tokenBalanceService: TokenBalanceService,
    private wallet: Wallet,
  ) {
    this.eventOrchestrator = new EventOrchestrator(chainSignaturesContract);
  }

  /**
   * Initiate an ERC20 deposit from Ethereum to Solana
   */
  async depositErc20(
    publicKey: PublicKey,
    erc20Address: string,
    amount: string,
    _decimals = 6,
    onStatusChange?: DepositStatusCallback,
  ): Promise<string> {
    let eventPromises: EventPromises | null = null;
    let requestId: string | null = null;

    try {
      // Fetch actual decimals from the contract
      const actualDecimals =
        await this.tokenBalanceService.getTokenDecimals(erc20Address);
      const provider = getPublicClient();

      const amountBigInt = ethers.parseUnits(amount, actualDecimals);
      const amountBN = new BN(amountBigInt.toString(), 10);

      const [vaultAuthority] =
        this.bridgeContract.deriveVaultAuthorityPda(publicKey);

      const path = publicKey.toString();
      const derivedAddress = CryptographyService.deriveEthereumAddress(
        path,
        vaultAuthority.toString(),
        CHAIN_SIGNATURES_CONFIG.BASE_PUBLIC_KEY,
      );

      const erc20AddressBytes =
        this.bridgeContract.erc20AddressToBytes(erc20Address);

      const transferInterface = new ethers.Interface([
        'function transfer(address to, uint256 amount) returns (bool)',
      ]);
      const callData = transferInterface.encodeFunctionData('transfer', [
        HARDCODED_RECIPIENT_ADDRESS,
        amountBigInt,
      ]);

      const currentNonce = await provider.getTransactionCount({
        address: derivedAddress as `0x${string}`,
      });

      const txParams = createEvmTransactionParams(currentNonce);

      const tempTx = {
        type: 2,
        chainId: SERVICE_CONFIG.ETHEREUM.CHAIN_ID,
        nonce: currentNonce,
        maxPriorityFeePerGas: txParams.maxPriorityFeePerGas,
        maxFeePerGas: txParams.maxFeePerGas,
        gasLimit: txParams.gasLimit,
        to: erc20Address,
        value: BigInt(0),
        data: callData,
      };

      const rlpEncodedTx = ethers.Transaction.from(tempTx).unsignedSerialized;

      requestId = generateRequestId(
        vaultAuthority,
        ethers.getBytes(rlpEncodedTx),
        SERVICE_CONFIG.ETHEREUM.SLIP44_COIN_TYPE,
        SERVICE_CONFIG.RETRY.DEFAULT_KEY_VERSION,
        path,
        SERVICE_CONFIG.CRYPTOGRAPHY.SIGNATURE_ALGORITHM,
        SERVICE_CONFIG.CRYPTOGRAPHY.TARGET_BLOCKCHAIN,
        '',
      );

      const requestIdBytes = this.bridgeContract.hexToBytes(requestId);

      const [pendingDepositPda] =
        this.bridgeContract.derivePendingDepositPda(requestIdBytes);

      const evmParams = evmParamsToProgram(txParams);

      // Setup event listeners BEFORE calling depositErc20
      eventPromises = await this.eventOrchestrator.subscribe(requestId, {
        timeout: SERVICE_CONFIG.TIMEOUTS.DEPOSIT_TIMEOUT,
      });

      await this.bridgeContract.depositErc20({
        authority: publicKey,
        requestIdBytes,
        erc20AddressBytes,
        amount: amountBN,
        evmParams,
      });

      onStatusChange?.({ status: 'processing' });

      this.processDepositFlow(
        requestId,
        tempTx,
        callData,
        eventPromises,
        provider,
        currentNonce,
        txParams,
        onStatusChange,
      ).catch(error => {
        console.error('Deposit flow failed:', error);
        if (
          error instanceof Error &&
          error.message.includes('already been processed')
        ) {
          onStatusChange?.({
            status: 'processing_interrupted',
            note: 'Flow interrupted due to already processed transaction',
          });
        } else {
          onStatusChange?.({
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });

      return requestId;
    } catch (error) {
      if (eventPromises && requestId && requestId !== null) {
        this.eventOrchestrator.unsubscribe(requestId);
      }

      console.error('Deposit ERC20 failed:', error);
      throw new Error(
        `Failed to deposit ERC20: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Process the entire deposit flow after the initial deposit call
   */
  private async processDepositFlow(
    requestId: string,
    unsignedTx: EthereumTransaction,
    callData: string,
    eventPromises: EventPromises,
    provider: PublicClient,
    nonce: number,
    txParams: any,
    onStatusChange?: DepositStatusCallback,
  ): Promise<void> {
    try {
      onStatusChange?.({ status: 'waiting_signature' });

      const signatureEvent = await eventPromises.signature;

      const signature = this.chainSignaturesContract.extractSignature(
        signatureEvent.signature,
      );

      const signedTx = ethers.Transaction.from({
        type: 2,
        chainId: ETHEREUM_CONFIG.CHAIN_ID,
        nonce,
        maxPriorityFeePerGas: BigInt(txParams.maxPriorityFeePerGas.toString()),
        maxFeePerGas: BigInt(txParams.maxFeePerGas.toString()),
        gasLimit: BigInt(txParams.gasLimit.toString()),
        to: unsignedTx.to,
        value: BigInt(0),
        data: callData,
        signature,
      });

      onStatusChange?.({ status: 'submitting_ethereum' });

      const txHash = await provider.request({
        method: 'eth_sendRawTransaction',
        params: [signedTx.serialized as `0x${string}`],
      });

      onStatusChange?.({
        status: 'confirming_ethereum',
        txHash,
      });

      const receipt = await provider.waitForTransactionReceipt({
        hash: txHash as `0x${string}`,
        confirmations: 1,
      });
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      onStatusChange?.({
        status: 'waiting_read_response',
        txHash,
      });

      await eventPromises.readRespond;

      onStatusChange?.({ status: 'ready_to_claim' });

      if (!this.wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      try {
        // Indicate that auto-claiming is starting
        onStatusChange?.({ status: 'auto_claiming' });

        const claimTxHash = await this.claimErc20(
          this.wallet.publicKey,
          requestId,
        );

        onStatusChange?.({
          status: 'completed',
          txHash: claimTxHash,
        });
      } catch (claimError) {
        console.error('Failed to claim tokens:', claimError);
        if (
          claimError instanceof Error &&
          claimError.message.includes('already been processed')
        ) {
          onStatusChange?.({
            status: 'completed',
            note: 'Tokens may have already been claimed',
          });
          return;
        }

        onStatusChange?.({
          status: 'claim_failed',
          error:
            claimError instanceof Error ? claimError.message : 'Unknown error',
        });
        throw claimError;
      }
    } catch (error) {
      console.error('Process deposit flow failed:', error);
      throw error;
    } finally {
      this.eventOrchestrator.unsubscribe(requestId);
    }
  }

  /**
   * Claim ERC20 tokens after successful deposit and read response
   */
  async claimErc20(publicKey: PublicKey, requestId: string): Promise<string> {
    try {
      const requestIdBytes = this.bridgeContract.hexToBytes(requestId);
      const [pendingDepositPda] =
        this.bridgeContract.derivePendingDepositPda(requestIdBytes);

      let pendingDeposit;
      try {
        pendingDeposit =
          await this.bridgeContract.fetchPendingDeposit(pendingDepositPda);
      } catch (error) {
        console.error('Failed to fetch pending deposit:', error);
        throw new Error(
          `No pending deposit found for request ID ${requestId}. Make sure you have successfully deposited ERC20 tokens first.`,
        );
      }

      const readEvent =
        await this.chainSignaturesContract.findReadResponseEventInLogs(
          requestId,
        );
      if (!readEvent) {
        throw new Error('Read response event not found for this request ID');
      }

      // Convert the signature to the format expected by the Solana program
      const convertedSignature = {
        bigR: {
          x: Array.from(readEvent.signature.bigR.x),
          y: Array.from(readEvent.signature.bigR.y),
        },
        s: Array.from(readEvent.signature.s),
        recoveryId: readEvent.signature.recoveryId,
      };

      const tx = await this.bridgeContract.claimErc20({
        authority: publicKey,
        requestIdBytes,
        serializedOutput: readEvent.serializedOutput,
        signature: convertedSignature,
        erc20AddressBytes: pendingDeposit.erc20Address,
      });

      return tx;
    } catch (error) {
      console.error('Failed to claim ERC20:', error);
      throw new Error(
        `Failed to claim ERC20: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
