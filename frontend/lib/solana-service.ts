import { Connection, PublicKey } from '@solana/web3.js';
import { BN, Wallet } from '@coral-xyz/anchor';
import { ethers } from 'ethers';
import { secp256k1 } from '@noble/curves/secp256k1';
import { encodeFunctionData, erc20Abi } from 'viem';

import type { TokenBalance } from '@/components/balance-table';
import {
  generateRequestId,
  createEvmTransactionParams,
  evmParamsToProgram,
} from '@/lib/program/utils';
import { getAutomatedProvider } from '@/lib/viem/providers';
import { BridgeContract } from '@/lib/contracts/bridge-contract';
import { ChainSignaturesContract } from '@/lib/contracts/chain-signatures-contract';

// Import types and constants from organized files
import type { EventPromises } from './types/chain-signatures.types';
import { CHAIN_SIGNATURES_CONFIG } from './constants/chain-signatures.constants';
import {
  COMMON_ERC20_ADDRESSES,
  HARDCODED_RECIPIENT_ADDRESS,
  ETHEREUM_CONFIG,
} from './constants/ethereum.constants';

// Using imported constants from constants file

function deriveEpsilon(requester: string, path: string): bigint {
  const derivationPath = `${CHAIN_SIGNATURES_CONFIG.EPSILON_DERIVATION_PREFIX},${CHAIN_SIGNATURES_CONFIG.SOLANA_CHAIN_ID},${requester},${path}`;
  const hash = ethers.keccak256(ethers.toUtf8Bytes(derivationPath));
  return BigInt(hash);
}

function publicKeyToPoint(publicKey: string): { x: bigint; y: bigint } {
  const cleanPubKey = publicKey.slice(4);
  const x = cleanPubKey.slice(0, 64);
  const y = cleanPubKey.slice(64, 128);
  return {
    x: BigInt('0x' + x),
    y: BigInt('0x' + y),
  };
}

function pointToPublicKey(point: { x: bigint; y: bigint }): string {
  const x = point.x.toString(16).padStart(64, '0');
  const y = point.y.toString(16).padStart(64, '0');
  return '0x04' + x + y;
}

function derivePublicKey(
  path: string,
  requesterAddress: string,
  basePublicKey: string,
): string {
  try {
    const epsilon = deriveEpsilon(requesterAddress, path);
    const basePoint = publicKeyToPoint(basePublicKey);

    const epsilonPoint = secp256k1.ProjectivePoint.BASE.multiply(epsilon);

    const baseProjectivePoint = new secp256k1.ProjectivePoint(
      basePoint.x,
      basePoint.y,
      BigInt(1),
    );

    const resultPoint = epsilonPoint.add(baseProjectivePoint);
    const resultAffine = resultPoint.toAffine();

    const derivedPublicKey = pointToPublicKey({
      x: resultAffine.x,
      y: resultAffine.y,
    });

    return derivedPublicKey;
  } catch (error) {
    console.error('Error deriving public key:', error);
    throw error;
  }
}

export class SolanaService {
  private bridgeContract: BridgeContract;
  private chainSignaturesContract: ChainSignaturesContract;

  constructor(
    private connection: Connection,
    private wallet: Wallet,
  ) {
    this.bridgeContract = new BridgeContract(connection, wallet);
    this.chainSignaturesContract = new ChainSignaturesContract(
      connection,
      wallet,
    );
  }

  async deriveDepositAddress(publicKey: PublicKey): Promise<string> {
    const [vaultAuthority] =
      this.bridgeContract.deriveVaultAuthorityPda(publicKey);

    const path = publicKey.toString();
    const derivedPublicKey = derivePublicKey(
      path,
      vaultAuthority.toString(),
      CHAIN_SIGNATURES_CONFIG.BASE_PUBLIC_KEY,
    );

    const derivedAddress = ethers.computeAddress(derivedPublicKey);

    return derivedAddress;
  }

  async fetchUserBalances(publicKey: PublicKey): Promise<TokenBalance[]> {
    try {
      const commonErc20Addresses = [...COMMON_ERC20_ADDRESSES] as string[];

      const balancesPromises = commonErc20Addresses.map(async erc20Address => {
        const balance = await this.fetchUserBalance(publicKey, erc20Address);
        if (balance !== '0') {
          return {
            erc20Address,
            amount: balance,
          };
        }
        return null;
      });

      const results = await Promise.all(balancesPromises);
      return results.filter(
        (result): result is TokenBalance => result !== null,
      );
    } catch (error) {
      console.error('Failed to fetch user balances:', error);
      throw new Error(
        `Failed to fetch user balances: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async fetchUserBalance(
    publicKey: PublicKey,
    erc20Address: string,
  ): Promise<string> {
    return await this.bridgeContract.fetchUserBalance(publicKey, erc20Address);
  }

  async depositErc20(
    publicKey: PublicKey,
    erc20Address: string,
    amount: string,
    decimals = 6,
    onStatusChange?: (status: {
      status: string;
      txHash?: string;
      note?: string;
      error?: string;
    }) => void,
  ): Promise<string> {
    let eventPromises: EventPromises | null = null;

    try {
      const amountBigInt = ethers.parseUnits(amount, decimals);
      const amountBN = new BN(amountBigInt.toString(), 10);

      const [vaultAuthority] =
        this.bridgeContract.deriveVaultAuthorityPda(publicKey);

      const path = publicKey.toString();
      const derivedPublicKey = derivePublicKey(
        path,
        vaultAuthority.toString(),
        CHAIN_SIGNATURES_CONFIG.BASE_PUBLIC_KEY,
      );
      const derivedAddress = ethers.computeAddress(derivedPublicKey);

      const erc20AddressBytes =
        this.bridgeContract.erc20AddressToBytes(erc20Address);

      const transferInterface = new ethers.Interface([
        'function transfer(address to, uint256 amount) returns (bool)',
      ]);
      const callData = transferInterface.encodeFunctionData('transfer', [
        HARDCODED_RECIPIENT_ADDRESS,
        amountBigInt,
      ]);

      const provider = getAutomatedProvider();
      const currentNonce = await provider.getTransactionCount({
        address: derivedAddress as `0x${string}`,
      });

      const txParams = createEvmTransactionParams(currentNonce);

      const tempTx = {
        type: 2,
        chainId: 11155111,
        nonce: currentNonce,
        maxPriorityFeePerGas: txParams.maxPriorityFeePerGas,
        maxFeePerGas: txParams.maxFeePerGas,
        gasLimit: txParams.gasLimit,
        to: erc20Address,
        value: BigInt(0),
        data: callData,
      };

      const rlpEncodedTx = ethers.Transaction.from(tempTx).unsignedSerialized;

      const requestId = generateRequestId(
        vaultAuthority,
        ethers.getBytes(rlpEncodedTx),
        60,
        0,
        path,
        'ECDSA',
        'ethereum',
        '',
      );

      const requestIdBytes = this.bridgeContract.hexToBytes(requestId);

      const [pendingDepositPda] =
        this.bridgeContract.derivePendingDepositPda(requestIdBytes);

      const existingPendingDeposit =
        await this.bridgeContract.checkPendingDepositExists(pendingDepositPda);
      if (existingPendingDeposit) {
        throw new Error(
          `A pending deposit already exists for this request. Please wait for it to be processed or use a different transaction.`,
        );
      }

      const evmParams = evmParamsToProgram(txParams);

      // Step 3: Setup event listeners BEFORE calling depositErc20
      eventPromises =
        this.chainSignaturesContract.setupEventListeners(requestId);

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
      if (eventPromises) {
        eventPromises.cleanup();
      }

      console.error('Deposit ERC20 failed:', error);
      throw new Error(
        `Failed to deposit ERC20: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async withdraw(
    publicKey: PublicKey,
    erc20Address: string,
    amount: string,
    recipientAddress: string,
    onStatusChange?: (status: {
      status: string;
      txHash?: string;
      note?: string;
      error?: string;
    }) => void,
  ): Promise<string> {
    let eventPromises: EventPromises | null = null;

    try {
      // Step 1: Get the global vault authority (requester for withdrawals)
      const [globalVaultAuthority] =
        this.bridgeContract.deriveGlobalVaultAuthorityPda();

      // Step 2: Convert amount to program format
      const amountBN = new BN(amount);
      const erc20AddressBytes = this.bridgeContract.hexToBytes(erc20Address);
      const recipientAddressBytes =
        this.bridgeContract.hexToBytes(recipientAddress);

      // Step 3: Get current nonce from the hardcoded recipient address (for withdrawals)
      const provider = getAutomatedProvider();
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
        args: [recipientAddress as `0x${string}`, BigInt(amount)],
      });

      const tempTx = {
        type: 2,
        chainId: 11155111,
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
        60, // Ethereum SLIP-44
        0, // key_version
        'root', // hardcoded root path for withdrawals
        'ECDSA',
        'ethereum',
        '',
      );

      const requestIdBytes = this.bridgeContract.hexToBytes(requestId);

      // Step 7: Setup event listeners BEFORE making the call
      eventPromises =
        this.chainSignaturesContract.setupEventListeners(requestId);

      // Step 8: Call withdrawErc20 on Solana
      await this.bridgeContract.withdrawErc20({
        authority: publicKey,
        requestIdBytes,
        erc20AddressBytes,
        amount: amountBN,
        recipientAddressBytes,
        evmParams,
      });

      // Step 9: Process the withdrawal flow
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
      if (eventPromises) {
        eventPromises.cleanup();
      }

      console.error('Withdraw failed:', error);
      throw new Error(
        `Failed to withdraw: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

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

  private async processDepositFlow(
    requestId: string,
    unsignedTx: any,
    callData: string,
    eventPromises: EventPromises,
    provider: any,
    nonce: number,
    txParams: any,
    onStatusChange?: (status: {
      status: string;
      txHash?: string;
      note?: string;
      error?: string;
    }) => void,
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
        params: [signedTx.serialized],
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
      eventPromises.cleanup();
    }
  }

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

  private async processWithdrawFlow(
    requestId: string,
    erc20Address: string,
    eventPromises: EventPromises,
    provider: any,
    tempTx: any,
    onStatusChange?: (status: {
      status: string;
      txHash?: string;
      note?: string;
      error?: string;
    }) => void,
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
      eventPromises.cleanup();
    }
  }
}
