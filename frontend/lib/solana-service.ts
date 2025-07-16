import { Connection, PublicKey } from '@solana/web3.js';
import { BN, Wallet } from '@coral-xyz/anchor';
import { ethers } from 'ethers';
import { secp256k1 } from '@noble/curves/secp256k1';
import * as borsh from 'borsh';
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes';

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
import type {
  ChainSignaturesSignature,
  EventPromises,
} from './types/chain-signatures.types';
import type {
  DecodedDepositInstruction,
  PendingErc20Deposit,
} from './types/bridge.types';
import { CHAIN_SIGNATURES_CONFIG } from './constants/chain-signatures.constants';
import { DEPOSIT_ERC20_BORSH_SCHEMA } from './constants/bridge.constants';
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

  async fetchPendingDeposits(
    publicKey: PublicKey,
  ): Promise<PendingErc20Deposit[]> {
    return await this.bridgeContract.fetchPendingDeposits(publicKey);
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
    _publicKey: PublicKey,
    _erc20Address: string,
    _amount: string,
  ): Promise<string> {
    throw new Error('Withdraw functionality not implemented yet');
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

  async getRawTransactionFromPreviousDeposit(
    requestId: string,
  ): Promise<any | null> {
    // Find signature from chain signatures program logs
    const signature =
      await this.chainSignaturesContract.findSignatureEventInLogs(requestId);

    // Find deposit instruction from bridge program logs
    const decodedInstruction =
      await this._findDepositInstructionInLogs(requestId);

    if (!decodedInstruction) {
      throw new Error('No matching transaction found');
    }

    if (!this.wallet.publicKey) {
      throw new Error('No wallet public key');
    }

    // Construct transaction from instruction data
    return this._constructTransactionFromInstruction(
      decodedInstruction,
      signature ?? undefined,
    );
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

  private _decodeDepositInstruction(
    instructionData: string,
  ): DecodedDepositInstruction | null {
    try {
      const instructionBuffer = bs58.decode(instructionData);
      const dataWithoutDiscriminator = instructionBuffer.slice(8);
      return borsh.deserialize(
        DEPOSIT_ERC20_BORSH_SCHEMA,
        dataWithoutDiscriminator,
      ) as DecodedDepositInstruction;
    } catch {
      return null;
    }
  }

  private async _findDepositInstructionInLogs(
    requestId: string,
  ): Promise<DecodedDepositInstruction | null> {
    const signatures = await this.connection.getSignaturesForAddress(
      this.bridgeContract.programId,
      { limit: 10 },
    );

    const requestIdBytes = Buffer.from(requestId.replace('0x', ''), 'hex');

    for (const signatureInfo of signatures) {
      const tx = await this.connection.getParsedTransaction(
        signatureInfo.signature,
        {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        },
      );

      for (const instruction of tx?.transaction.message.instructions || []) {
        if (!('data' in instruction)) {
          continue;
        }

        const decodedInstruction = this._decodeDepositInstruction(
          instruction.data,
        );
        if (!decodedInstruction) {
          continue;
        }

        const eventRequestIdBytes = Buffer.from(decodedInstruction.requestId);
        if (eventRequestIdBytes.equals(requestIdBytes)) {
          return decodedInstruction;
        }
      }
    }

    return null;
  }

  private _constructTransactionFromInstruction(
    decodedInstruction: DecodedDepositInstruction,
    signature?: ChainSignaturesSignature,
  ): any {
    const erc20Address = `0x${Buffer.from(decodedInstruction.erc20Address).toString('hex')}`;

    const transferInterface = new ethers.Interface([
      'function transfer(address to, uint256 amount) returns (bool)',
    ]);
    const callData = transferInterface.encodeFunctionData('transfer', [
      HARDCODED_RECIPIENT_ADDRESS,
      decodedInstruction.amount,
    ]);

    const transaction = {
      type: 2,
      chainId: Number(decodedInstruction.txParams.chainId),
      nonce: Number(decodedInstruction.txParams.nonce),
      maxPriorityFeePerGas: decodedInstruction.txParams.maxPriorityFeePerGas,
      maxFeePerGas: decodedInstruction.txParams.maxFeePerGas,
      gasLimit: decodedInstruction.txParams.gasLimit,
      to: erc20Address,
      value: decodedInstruction.txParams.value,
      data: callData,
    };

    if (signature) {
      const r =
        '0x' + Buffer.from(signature.bigR.x).toString('hex').padStart(64, '0');
      const s =
        '0x' + Buffer.from(signature.s).toString('hex').padStart(64, '0');
      const v = BigInt(27 + signature.recoveryId);

      return {
        ...transaction,
        signature: { r, s, v },
      };
    }

    return transaction;
  }
}
