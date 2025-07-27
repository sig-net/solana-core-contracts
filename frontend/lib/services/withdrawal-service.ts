import { PublicKey } from '@solana/web3.js';
import { BN, Wallet } from '@coral-xyz/anchor';
import { ethers } from 'ethers';
import { encodeFunctionData, erc20Abi, type PublicClient } from 'viem';

import {
  generateRequestId,
  createEvmTransactionParams,
  evmParamsToProgram,
} from '@/lib/program/utils';
import { getPublicClient } from '@/lib/viem/providers';
import { BridgeContract } from '@/lib/contracts/bridge-contract';
import { ChainSignaturesContract } from '@/lib/contracts/chain-signatures-contract';
import { TokenBalanceService } from '@/lib/services/token-balance-service';
import { EventOrchestrator } from '@/lib/services/event-orchestrator';
import type { EventPromises } from '@/lib/types/chain-signatures.types';
import type { EthereumTransaction } from '@/lib/types/ethereum.types';
import type { WithdrawalStatusCallback } from '@/lib/types/shared.types';
import { HARDCODED_RECIPIENT_ADDRESS } from '@/lib/constants/ethereum.constants';
import { SERVICE_CONFIG } from '@/lib/constants/service.config';

/**
 * WithdrawalService handles all ERC20 withdrawal operations including
 * initiating withdrawals, processing the flow, and completing withdrawals.
 */
export class WithdrawalService {
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
   * Initiate an ERC20 withdrawal from Solana to Ethereum
   */
  async withdraw(
    publicKey: PublicKey,
    erc20Address: string,
    amount: string,
    recipientAddress: string,
    onStatusChange?: WithdrawalStatusCallback,
  ): Promise<string> {
    let eventPromises: EventPromises | null = null;

    try {
      // Step 1: Get the global vault authority (requester for withdrawals)
      const [globalVaultAuthority] =
        this.bridgeContract.deriveGlobalVaultAuthorityPda();

      // Step 2: Get token decimals and convert amount to proper format
      const decimals =
        await this.tokenBalanceService.getTokenDecimals(erc20Address);
      const amountBigInt = ethers.parseUnits(amount, decimals);
      const amountBN = new BN(amountBigInt.toString());
      const erc20AddressBytes = this.bridgeContract.hexToBytes(erc20Address);

      // Validate and convert recipient address (must be Ethereum format)
      if (!ethers.isAddress(recipientAddress)) {
        throw new Error('Invalid Ethereum address format');
      }

      // Get properly checksummed address for ethers compatibility
      const checksummedAddress = ethers.getAddress(recipientAddress);
      const recipientAddressBytes =
        this.bridgeContract.hexToBytes(checksummedAddress);

      // Step 3: Get current nonce from the hardcoded recipient address (for withdrawals)
      const provider = getPublicClient();
      const currentNonce = await provider.getTransactionCount({
        address: HARDCODED_RECIPIENT_ADDRESS as `0x${string}`,
        blockTag: 'pending',
      });

      // Step 4: Create EVM transaction parameters
      const txParams = createEvmTransactionParams(Number(currentNonce));
      const evmParams = evmParamsToProgram(txParams);

      // Step 5: Build EVM transaction to generate proper request ID
      const callData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [checksummedAddress as `0x${string}`, amountBigInt],
      });

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

      // Step 6: Generate proper request ID using root path for withdrawals
      const requestId = generateRequestId(
        globalVaultAuthority,
        ethers.getBytes(rlpEncodedTx),
        SERVICE_CONFIG.ETHEREUM.SLIP44_COIN_TYPE,
        SERVICE_CONFIG.RETRY.DEFAULT_KEY_VERSION,
        SERVICE_CONFIG.CRYPTOGRAPHY.WITHDRAWAL_ROOT_PATH,
        SERVICE_CONFIG.CRYPTOGRAPHY.SIGNATURE_ALGORITHM,
        SERVICE_CONFIG.CRYPTOGRAPHY.TARGET_BLOCKCHAIN,
        '',
      );

      const requestIdBytes = this.bridgeContract.hexToBytes(requestId);

      // Step 7: Setup event listeners BEFORE making the call
      eventPromises = await this.eventOrchestrator.subscribe(requestId);

      // Step 8: Call withdrawErc20 on Solana
      await this.bridgeContract.withdrawErc20({
        authority: publicKey,
        requestIdBytes,
        erc20AddressBytes,
        amount: amountBN,
        recipientAddressBytes,
        evmParams,
      });

      onStatusChange?.({ status: 'processing' });

      this.processWithdrawFlow(
        requestId,
        erc20Address,
        eventPromises!,
        provider,
        tempTx,
        onStatusChange,
      ).catch(error => {
        console.error('Withdraw flow failed:', error);
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
      if (eventPromises && requestId) {
        this.eventOrchestrator.unsubscribe(requestId);
      }

      console.error('Withdraw failed:', error);
      throw new Error(
        `Failed to withdraw: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Complete withdrawal after read response is available
   */
  async completeWithdraw(
    publicKey: PublicKey,
    requestId: string,
    erc20Address: string,
  ): Promise<string> {
    try {
      const requestIdBytes = this.bridgeContract.hexToBytes(requestId);
      const erc20AddressBytes = this.bridgeContract.hexToBytes(erc20Address);

      // Step 1: Get pending withdrawal details
      const [pendingWithdrawalPda] =
        this.bridgeContract.derivePendingWithdrawalPda(requestIdBytes);
      try {
        await this.bridgeContract.fetchPendingWithdrawal(pendingWithdrawalPda);
      } catch (error) {
        console.error('Failed to fetch pending withdrawal:', error);
        throw new Error(
          `No pending withdrawal found for request ID ${requestId}. Make sure you have successfully initiated withdrawal first.`,
        );
      }

      // Step 2: Get read response event
      const readEvent =
        await this.chainSignaturesContract.findReadResponseEventInLogs(
          requestId,
        );
      if (!readEvent) {
        throw new Error('Read response event not found for this request ID');
      }

      // Step 3: Convert signature format
      const convertedSignature = {
        bigR: {
          x: Array.from(readEvent.signature.bigR.x),
          y: Array.from(readEvent.signature.bigR.y),
        },
        s: Array.from(readEvent.signature.s),
        recoveryId: readEvent.signature.recoveryId,
      };

      // Step 4: Complete withdrawal
      const tx = await this.bridgeContract.completeWithdrawErc20({
        authority: publicKey,
        requestIdBytes,
        serializedOutput: readEvent.serializedOutput,
        signature: convertedSignature,
        erc20AddressBytes,
      });

      return tx;
    } catch (error) {
      console.error('Failed to complete withdrawal:', error);
      throw new Error(
        `Failed to complete withdrawal: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Process the entire withdrawal flow after the initial withdrawal call
   */
  private async processWithdrawFlow(
    requestId: string,
    erc20Address: string,
    eventPromises: EventPromises,
    provider: PublicClient,
    tempTx: EthereumTransaction,
    onStatusChange?: WithdrawalStatusCallback,
  ): Promise<void> {
    try {
      // Step 1: Wait for signature from MPC network
      onStatusChange?.({ status: 'waiting_signature' });

      const signatureEvent = await eventPromises.signature;
      const ethereumSignature = this.chainSignaturesContract.extractSignature(
        signatureEvent.signature,
      );

      // Step 2: Build signed transaction using the pre-built tempTx
      const signedTx = ethers.Transaction.from({
        ...tempTx,
        signature: ethereumSignature,
      });

      // Step 3: Submit to Ethereum network
      onStatusChange?.({ status: 'submitting_ethereum' });

      const txHash = await provider.sendRawTransaction({
        serializedTransaction: signedTx.serialized as `0x${string}`,
      });

      // Step 4: Wait for Ethereum confirmation
      onStatusChange?.({
        status: 'confirming_ethereum',
        txHash,
      });

      await provider.waitForTransactionReceipt({
        hash: txHash,
      });

      // Step 5: Wait for read response from MPC network
      onStatusChange?.({
        status: 'waiting_read_response',
        txHash,
      });

      await eventPromises.readRespond;

      // Step 6: Complete the withdrawal
      onStatusChange?.({ status: 'completing_withdrawal' });

      if (!this.wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      try {
        const completeTxHash = await this.completeWithdraw(
          this.wallet.publicKey,
          requestId,
          erc20Address,
        );

        onStatusChange?.({
          status: 'completed',
          txHash: completeTxHash,
        });
      } catch (completeError) {
        console.error('Failed to complete withdrawal:', completeError);
        if (
          completeError instanceof Error &&
          completeError.message.includes('already been processed')
        ) {
          onStatusChange?.({
            status: 'completed',
            note: 'Withdrawal may have already been completed',
          });
          return;
        }

        onStatusChange?.({
          status: 'complete_failed',
          error:
            completeError instanceof Error
              ? completeError.message
              : 'Unknown error',
        });
        throw completeError;
      }
    } catch (error) {
      console.error('Process withdraw flow failed:', error);
      throw error;
    } finally {
      this.eventOrchestrator.unsubscribe(requestId);
    }
  }

  /**
   * Fetch all user withdrawals (pending + historical)
   */
  async fetchAllUserWithdrawals(publicKey: PublicKey) {
    return this.bridgeContract.fetchAllUserWithdrawals(publicKey);
  }
}
