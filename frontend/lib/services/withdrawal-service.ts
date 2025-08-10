import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { BN } from '@coral-xyz/anchor';
import { ethers } from 'ethers';
import { encodeFunctionData, erc20Abi, Hex, toBytes } from 'viem';

import { getTokenInfo } from '@/lib/utils/token-formatting';
import { buildErc20TransferTx } from '@/lib/evm/tx-builder';
import { generateRequestId, evmParamsToProgram } from '@/lib/program/utils';
import type { EvmTransactionRequest } from '@/lib/types/shared.types';
import { BridgeContract } from '@/lib/contracts/bridge-contract';
import { TokenBalanceService } from '@/lib/services/token-balance-service';
import { RelayerService } from '@/lib/services/relayer-service';
import type { StatusCallback } from '@/lib/types/shared.types';
import {
  VAULT_ETHEREUM_ADDRESS,
  GLOBAL_VAULT_AUTHORITY_PDA,
} from '@/lib/constants/addresses';
import { SERVICE_CONFIG } from '@/lib/constants/service.config';

import { getAlchemyProvider, getEthereumProvider } from '../utils/providers';

/**
 * WithdrawalService handles ERC20 withdrawal initiation.
 * The relayer handles withdrawal completion automatically.
 */
export class WithdrawalService {
  private relayerService: RelayerService;
  private alchemy = getAlchemyProvider();

  constructor(
    private bridgeContract: BridgeContract,
    private tokenBalanceService: TokenBalanceService,
  ) {
    this.relayerService = new RelayerService();
  }

  /**
   * Perform a direct SPL token transfer on Solana.
   */
  async withdrawSol(
    publicKey: PublicKey,
    mintAddress: string,
    amount: string,
    recipientAddress: string,
    decimals = 6,
    onStatusChange?: StatusCallback,
  ): Promise<string> {
    try {
      const connection: Connection = this.bridgeContract.getConnection();
      const wallet = this.bridgeContract.getWallet();
      if (!wallet.publicKey || !wallet.signTransaction) {
        throw new Error('Wallet not available for SPL transfer');
      }

      const mint = new PublicKey(mintAddress);
      const senderAta = await getAssociatedTokenAddress(
        mint,
        publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      const recipientPubkey = new PublicKey(recipientAddress);
      const recipientAta = await getAssociatedTokenAddress(
        mint,
        recipientPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      const amountInUnits = BigInt(
        ethers.parseUnits(amount, decimals).toString(),
      );

      const instructions = [] as Array<Parameters<Transaction['add']>[0]>;

      const recipientAtaInfo = await connection.getAccountInfo(recipientAta);
      if (!recipientAtaInfo) {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            publicKey,
            recipientAta,
            recipientPubkey,
            mint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID,
          ),
        );
      }

      instructions.push(
        createTransferInstruction(
          senderAta,
          recipientAta,
          publicKey,
          amountInUnits,
          [],
          TOKEN_PROGRAM_ID,
        ),
      );

      const tx = new Transaction().add(...instructions);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const signed = await wallet.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());

      onStatusChange?.({
        status: 'completed',
        txHash: sig,
        note: 'SPL transfer submitted',
      });

      return sig;
    } catch (error) {
      throw new Error(
        `Failed to initiate Solana withdrawal: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Initiate an ERC20 withdrawal via the cross-chain bridge and relayer.
   */
  async withdrawEvm(
    publicKey: PublicKey,
    erc20Address: string,
    amount: string,
    recipientAddress: string,
    onStatusChange?: StatusCallback,
  ): Promise<string> {
    try {
      // Get the global vault authority (requester for withdrawals)
      const globalVaultAuthority = GLOBAL_VAULT_AUTHORITY_PDA;

      // Get token decimals and convert amount to proper format
      const decimals = (await getTokenInfo(erc20Address)).decimals;

      const amountBigInt = ethers.parseUnits(amount, decimals);

      // Subtract a small random amount to avoid PDA collisions
      const randomReduction = BigInt(Math.floor(Math.random() * 100) + 1); // 1-100 wei
      const processAmountBigInt = amountBigInt - randomReduction;

      const amountBN = new BN(processAmountBigInt.toString());
      const erc20AddressBytes = Array.from(toBytes(erc20Address));

      // Validate and convert recipient address (must be Ethereum format)
      if (!ethers.isAddress(recipientAddress)) {
        throw new Error('Invalid Ethereum address format');
      }

      const checksummedAddress = ethers.getAddress(recipientAddress);
      const recipientAddressBytes = Array.from(toBytes(checksummedAddress));

      // Get current nonce from the hardcoded recipient address (for withdrawals)
      const _nonce = await this.alchemy.core.getTransactionCount(
        VAULT_ETHEREUM_ADDRESS,
      );

      // Build EVM transaction call data first
      const _callData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [checksummedAddress as Hex, processAmountBigInt],
      });

      const txRequest: EvmTransactionRequest = await buildErc20TransferTx({
        provider: getEthereumProvider(),
        from: VAULT_ETHEREUM_ADDRESS,
        erc20Address,
        recipient: checksummedAddress,
        amount: processAmountBigInt,
      });

      const evmParams = evmParamsToProgram(txRequest);

      const rlpEncodedTx =
        ethers.Transaction.from(txRequest).unsignedSerialized;

      // Generate proper request ID using root path for withdrawals
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

      const requestIdBytes = Array.from(toBytes(requestId));

      // Notify relayer FIRST to set up event listeners before transaction
      await this.relayerService.notifyWithdrawal({
        requestId,
        erc20Address,
        // Pass the exact transaction parameters used for signing
        transactionParams: {
          ...txRequest,
          maxPriorityFeePerGas: txRequest.maxPriorityFeePerGas.toString(),
          maxFeePerGas: txRequest.maxFeePerGas.toString(),
          gasLimit: txRequest.gasLimit.toString(),
          value: txRequest.value.toString(),
        },
      });

      onStatusChange?.({
        status: 'preparing',
        note: 'Setting up withdrawal monitoring...',
      });

      // Call withdrawErc20 on Solana AFTER relayer is ready
      await this.bridgeContract.withdrawErc20({
        authority: publicKey,
        requestIdBytes,
        erc20AddressBytes,
        amount: amountBN,
        recipientAddressBytes,
        evmParams,
      });

      onStatusChange?.({
        status: 'relayer_processing',
        note: 'Withdrawal initiated. Relayer will complete the process.',
      });

      return requestId;
    } catch (error) {
      throw new Error(
        `Failed to initiate EVM withdrawal: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Fetch all user withdrawals (pending + historical)
   */
  async fetchAllUserWithdrawals(publicKey: PublicKey) {
    return this.bridgeContract.fetchAllUserWithdrawals(publicKey);
  }
}
