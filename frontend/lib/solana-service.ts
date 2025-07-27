import { Connection, PublicKey } from '@solana/web3.js';
import { BN, Wallet } from '@coral-xyz/anchor';
import { ethers } from 'ethers';
import { secp256k1 } from '@noble/curves/secp256k1';
import { encodeFunctionData, erc20Abi } from 'viem';

import type {
  TokenBalance,
  UnclaimedTokenBalance,
} from '@/lib/types/token.types';
import {
  generateRequestId,
  createEvmTransactionParams,
  evmParamsToProgram,
} from '@/lib/program/utils';
import { getAutomatedProvider } from '@/lib/viem/providers';
import { BridgeContract } from '@/lib/contracts/bridge-contract';
import { ChainSignaturesContract } from '@/lib/contracts/chain-signatures-contract';
import { getTokenMetadata } from '@/lib/constants/token-metadata';
import { RATE_LIMITERS, REQUEST_DEDUPLICATOR } from '@/lib/utils/rpc-utils';

import type { EventPromises } from './types/chain-signatures.types';
import { CHAIN_SIGNATURES_CONFIG } from './constants/chain-signatures.constants';
import {
  COMMON_ERC20_ADDRESSES,
  HARDCODED_RECIPIENT_ADDRESS,
  ETHEREUM_CONFIG,
} from './constants/ethereum.constants';

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

    // Using ProjectivePoint (suppressing deprecation warnings as it's still functional)
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
  private decimalsCache = new Map<string, number>();
  private decimalsCacheExpiry = new Map<string, number>();
  private readonly DECIMALS_CACHE_TTL = 300000; // 5 minutes

  constructor(
    connection: Connection,
    private wallet: Wallet,
  ) {
    this.bridgeContract = new BridgeContract(connection, wallet);
    this.chainSignaturesContract = new ChainSignaturesContract(
      connection,
      wallet,
    );
  }

  async getTokenDecimals(erc20Address: string): Promise<number> {
    const cacheKey = erc20Address.toLowerCase();
    const now = Date.now();

    // Check cache first
    if (this.decimalsCache.has(cacheKey)) {
      const expiry = this.decimalsCacheExpiry.get(cacheKey) || 0;
      if (now < expiry) {
        return this.decimalsCache.get(cacheKey)!;
      }
    }

    const provider = getAutomatedProvider();
    try {
      const contractDecimals = await provider.readContract({
        address: erc20Address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'decimals',
      });
      const decimals = Number(contractDecimals);

      // Cache the result
      this.decimalsCache.set(cacheKey, decimals);
      this.decimalsCacheExpiry.set(cacheKey, now + this.DECIMALS_CACHE_TTL);

      return decimals;
    } catch {
      const tokenMetadata = getTokenMetadata(erc20Address);
      const decimals = tokenMetadata?.decimals || 18; // Default to 18 if unknown

      // Cache fallback result for shorter duration
      this.decimalsCache.set(cacheKey, decimals);
      this.decimalsCacheExpiry.set(cacheKey, now + 60000); // 1 minute for fallback

      return decimals;
    }
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

  /**
   * Batch fetch ERC20 balances for multiple tokens with rate limiting and deduplication
   */
  private async batchFetchErc20Balances(
    address: string,
    tokenAddresses: string[],
  ): Promise<Array<{ address: string; balance: bigint; decimals: number }>> {
    const requestKey = `balances:${address}:${tokenAddresses.join(',')}`;

    return REQUEST_DEDUPLICATOR.execute(requestKey, async () => {
      const provider = getAutomatedProvider();

      // Rate limit balance requests
      const balancePromises = tokenAddresses.map(async tokenAddress => {
        return this.rateLimitedRequest(async () => {
          try {
            const balance = await provider.readContract({
              address: tokenAddress as `0x${string}`,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [address as `0x${string}`],
            });
            return { address: tokenAddress, balance: balance as bigint };
          } catch (error) {
            console.error(`Error fetching balance for ${tokenAddress}:`, error);
            return { address: tokenAddress, balance: BigInt(0) };
          }
        });
      });

      const balanceResults = await Promise.all(balancePromises);

      // Only fetch decimals for tokens with non-zero balances (cached method)
      const nonZeroBalances = balanceResults.filter(
        result => result.balance > BigInt(0),
      );
      const decimalsPromises = nonZeroBalances.map(async result => {
        const decimals = await this.getTokenDecimals(result.address);
        return { ...result, decimals };
      });

      const finalResults = await Promise.all(decimalsPromises);

      // Include zero balances with default decimals for completeness
      const zeroBalances = balanceResults
        .filter(result => result.balance === BigInt(0))
        .map(result => ({ ...result, decimals: 18 })); // Default decimals for zero balances

      return [...finalResults, ...zeroBalances];
    });
  }

  /**
   * Rate limited request wrapper for Alchemy calls
   */
  private async rateLimitedRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    // Check rate limit
    if (!RATE_LIMITERS.alchemy.tryConsume()) {
      const retryAfter = RATE_LIMITERS.alchemy.getRetryAfter();
      if (retryAfter > 0) {
        console.warn(`Rate limit reached, waiting ${retryAfter}ms`);
        await new Promise(resolve => setTimeout(resolve, retryAfter));
      }
    }

    return requestFn();
  }

  async fetchUnclaimedBalances(
    publicKey: PublicKey,
  ): Promise<UnclaimedTokenBalance[]> {
    try {
      const derivedAddress = await this.deriveDepositAddress(publicKey);
      const commonErc20Addresses = [...COMMON_ERC20_ADDRESSES] as string[];

      // Use batch fetching to reduce RPC calls
      const batchResults = await this.batchFetchErc20Balances(
        derivedAddress,
        commonErc20Addresses,
      );

      const results: UnclaimedTokenBalance[] = [];

      for (const result of batchResults) {
        if (result.balance > BigInt(0)) {
          const tokenMetadata = getTokenMetadata(result.address);
          results.push({
            erc20Address: result.address,
            amount: result.balance.toString(),
            symbol: tokenMetadata?.symbol || 'Unknown',
            name: tokenMetadata?.name || 'Unknown Token',
            decimals: result.decimals,
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error fetching unclaimed balances:', error);
      return [];
    }
  }

  async fetchUserBalances(publicKey: PublicKey): Promise<TokenBalance[]> {
    try {
      const commonErc20Addresses = [...COMMON_ERC20_ADDRESSES] as string[];

      const balancesPromises = commonErc20Addresses.map(async erc20Address => {
        const balance = await this.fetchUserBalance(publicKey, erc20Address);
        if (balance !== '0') {
          const decimals = await this.getTokenDecimals(erc20Address);
          return {
            erc20Address,
            amount: balance,
            decimals,
          };
        }
        return null;
      });

      const results = await Promise.all(balancesPromises);
      return results.filter(result => result !== null);
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
    _decimals = 6,
    onStatusChange?: (status: {
      status: string;
      txHash?: string;
      note?: string;
      error?: string;
    }) => void,
  ): Promise<string> {
    let eventPromises: EventPromises | null = null;

    try {
      // Fetch actual decimals from the contract
      const actualDecimals = await this.getTokenDecimals(erc20Address);
      const provider = getAutomatedProvider();

      const amountBigInt = ethers.parseUnits(amount, actualDecimals);
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

      // Check if a pending deposit already exists
      const existingPendingDeposit =
        await this.bridgeContract.checkPendingDepositExists(pendingDepositPda);
      if (existingPendingDeposit) {
        throw new Error(
          `A pending deposit already exists for this request. Please wait for it to be processed before initiating a new deposit.`,
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

      // Step 2: Get token decimals and convert amount to proper format
      const decimals = await this.getTokenDecimals(erc20Address);
      const amountBigInt = ethers.parseUnits(amount, decimals);
      const amountBN = new BN(amountBigInt.toString());
      const erc20AddressBytes = this.bridgeContract.hexToBytes(erc20Address);

      console.log('recipientAddress', recipientAddress);

      // Validate and convert recipient address (must be Ethereum format)
      if (!ethers.isAddress(recipientAddress)) {
        throw new Error('Invalid Ethereum address format');
      }

      // Get properly checksummed address for ethers compatibility
      const checksummedAddress = ethers.getAddress(recipientAddress);
      const recipientAddressBytes =
        this.bridgeContract.hexToBytes(checksummedAddress);

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
        args: [checksummedAddress as `0x${string}`, amountBigInt],
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

      // Step 7.5: Wait briefly to ensure event listeners are properly registered
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log(
        'Event listeners set up, proceeding with withdrawal transaction',
      );

      // Step 8: Call withdrawErc20 on Solana
      await this.bridgeContract.withdrawErc20({
        authority: publicKey,
        requestIdBytes,
        erc20AddressBytes,
        amount: amountBN,
        recipientAddressBytes,
        evmParams,
      });

      console.log(
        'Withdrawal transaction submitted to Solana, request ID:',
        requestId,
      );

      // Step 9: Process the withdrawal flow with overall timeout
      onStatusChange?.({ status: 'processing' });

      // Add overall timeout to prevent infinite hanging
      Promise.race([
        this.processWithdrawFlow(
          requestId,
          erc20Address,
          eventPromises!,
          provider,
          tempTx,
          onStatusChange,
        ),
        new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error('Withdrawal process timed out after 10 minutes'),
              ),
            600000,
          ),
        ),
      ]).catch(error => {
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

      try {
        await Promise.race([
          eventPromises.readRespond,
          this.waitWithFallback(requestId, 'readRespond'),
        ]);
      } catch (readError) {
        console.error('Read respond event failed:', readError);
        // Try to find read response in logs as fallback
        console.log('Attempting to find read response in transaction logs...');
        const logReadResponse =
          await this.chainSignaturesContract.findReadResponseEventInLogs(
            requestId,
          );
        if (!logReadResponse) {
          throw new Error(
            'MPC read response not found - the transaction monitoring may have failed',
          );
        }
        console.log('Found read response in logs as fallback');
      }

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

  /**
   * Fetch all user withdrawals (pending + historical)
   */
  async fetchAllUserWithdrawals(publicKey: PublicKey) {
    return this.bridgeContract.fetchAllUserWithdrawals(publicKey);
  }

  /**
   * Fallback method that waits and periodically checks transaction logs for events
   */
  private async waitWithFallback(
    requestId: string,
    eventType: 'signature' | 'readRespond',
    maxWaitTime = 180000, // 3 minutes
    checkInterval = 10000, // 10 seconds
  ): Promise<never> {
    const startTime = Date.now();

    return new Promise((_, reject) => {
      const checkLogs = async () => {
        try {
          if (eventType === 'signature') {
            const signature =
              await this.chainSignaturesContract.findSignatureEventInLogs(
                requestId,
              );
            if (signature) {
              // Don't resolve here, let the main event listener handle it
              console.log('Found signature in periodic log check');
              return;
            }
          } else if (eventType === 'readRespond') {
            const readResponse =
              await this.chainSignaturesContract.findReadResponseEventInLogs(
                requestId,
              );
            if (readResponse) {
              // Don't resolve here, let the main event listener handle it
              console.log('Found read response in periodic log check');
              return;
            }
          }

          // Check if we've exceeded max wait time
          if (Date.now() - startTime > maxWaitTime) {
            reject(
              new Error(
                `${eventType} event not found within ${maxWaitTime / 1000} seconds`,
              ),
            );
            return;
          }

          // Schedule next check
          setTimeout(checkLogs, checkInterval);
        } catch (error) {
          console.error(`Error checking logs for ${eventType}:`, error);
          // Continue checking despite errors
          setTimeout(checkLogs, checkInterval);
        }
      };

      // Start periodic checking
      setTimeout(checkLogs, checkInterval);
    });
  }

  /**
   * Get available balance for a specific token, adjusted for contract bug
   * Returns both the formatted amount and the actual decimals used
   */
  async getAdjustedAvailableBalance(
    publicKey: PublicKey,
    erc20Address: string,
  ): Promise<{ amount: string; decimals: number }> {
    const unclaimedBalances = await this.fetchUnclaimedBalances(publicKey);

    const tokenBalance = unclaimedBalances.find(
      balance =>
        balance.erc20Address.toLowerCase() === erc20Address.toLowerCase(),
    );

    if (!tokenBalance || !tokenBalance.amount || tokenBalance.amount === '0') {
      throw new Error(
        `No ${erc20Address} tokens available in the derived address`,
      );
    }

    // Apply random subtraction to work around contract bug
    const balance = BigInt(tokenBalance.amount);
    const randomSubtraction = BigInt(Math.floor(Math.random() * 1000) + 1);
    const adjustedBalance = balance - randomSubtraction;

    // Ensure we don't go negative
    const finalBalance =
      adjustedBalance > BigInt(0) ? adjustedBalance : BigInt(1);

    // Convert to decimal format using the actual contract decimals
    const balanceInUnits = ethers.formatUnits(
      finalBalance,
      tokenBalance.decimals,
    );

    return {
      amount: balanceInUnits,
      decimals: tokenBalance.decimals,
    };
  }
}
