import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { ethers } from 'ethers';
import { encodeFunctionData, erc20Abi, Hex } from 'viem';

import {
  generateRequestId,
  createEvmTransactionBaseParams,
  evmParamsToProgram,
} from '@/lib/program/utils';
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

import { getAlchemyProvider } from '../utils/providers';

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
   * Initiate an ERC20 withdrawal from Solana to Ethereum
   */
  async withdraw(
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
      const decimals =
        await this.tokenBalanceService.getTokenDecimals(erc20Address);

      const amountBigInt = ethers.parseUnits(amount, decimals);

      // Subtract a small random amount to avoid PDA collisions
      const randomReduction = BigInt(Math.floor(Math.random() * 100) + 1); // 1-100 wei
      const processAmountBigInt = amountBigInt - randomReduction;

      const amountBN = new BN(processAmountBigInt.toString());
      const erc20AddressBytes = this.bridgeContract.hexToBytes(erc20Address);

      // Validate and convert recipient address (must be Ethereum format)
      if (!ethers.isAddress(recipientAddress)) {
        throw new Error('Invalid Ethereum address format');
      }

      const checksummedAddress = ethers.getAddress(recipientAddress);
      const recipientAddressBytes =
        this.bridgeContract.hexToBytes(checksummedAddress);

      // Get current nonce from the hardcoded recipient address (for withdrawals)
      const currentNonce = await this.alchemy.core.getTransactionCount(
        VAULT_ETHEREUM_ADDRESS,
      );

      // Build EVM transaction call data first
      const callData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [checksummedAddress as Hex, processAmountBigInt],
      });

      const estimatedGas = await this.alchemy.core.estimateGas({
        from: VAULT_ETHEREUM_ADDRESS,
        to: erc20Address,
        data: callData,
        value: 0,
      });

      // Create comprehensive EVM transaction request
      const baseParams = await createEvmTransactionBaseParams(
        Number(currentNonce),
        Number(estimatedGas),
      );

      const txRequest: EvmTransactionRequest = {
        ...baseParams,
        to: erc20Address as Hex,
        value: BigInt(0),
        data: callData,
      };

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

      const requestIdBytes = this.bridgeContract.hexToBytes(requestId);

      // Notify relayer FIRST to set up event listeners before transaction
      await this.relayerService.notifyWithdrawal({
        requestId,
        erc20Address,
        // Pass the exact transaction parameters used for signing
        transactionParams: txRequest,
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
        `Failed to initiate withdrawal: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
