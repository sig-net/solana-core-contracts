import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { ethers } from 'ethers';
import { encodeFunctionData, erc20Abi } from 'viem';

import {
  generateRequestId,
  createEvmTransactionParams,
  evmParamsToProgram,
} from '@/lib/program/utils';
import { BridgeContract } from '@/lib/contracts/bridge-contract';
import { TokenBalanceService } from '@/lib/services/token-balance-service';
import { RelayerService } from '@/lib/services/relayer-service';
import type { StatusCallback } from '@/lib/types/shared.types';
import { VAULT_ETHEREUM_ADDRESS } from '@/lib/constants/addresses';
import { SERVICE_CONFIG } from '@/lib/constants/service.config';

import { alchemy } from './alchemy-service';

/**
 * WithdrawalService handles ERC20 withdrawal initiation.
 * The relayer handles withdrawal completion automatically.
 */
export class WithdrawalService {
  private relayerService: RelayerService;

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
      const [globalVaultAuthority] =
        this.bridgeContract.deriveGlobalVaultAuthorityPda();

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
      const currentNonce = await alchemy.core.getTransactionCount(
        VAULT_ETHEREUM_ADDRESS,
      );

      // Build EVM transaction call data first
      const callData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [checksummedAddress as `0x${string}`, processAmountBigInt],
      });

      const estimatedGas = await alchemy.core.estimateGas({
        from: VAULT_ETHEREUM_ADDRESS,
        to: erc20Address,
        data: callData,
        value: 0,
      });

      // Create EVM transaction parameters with estimated gas limit
      const txParams = await createEvmTransactionParams(
        Number(currentNonce),
        Number(estimatedGas),
      );
      const evmParams = evmParamsToProgram(txParams);

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

      // Call withdrawErc20 on Solana
      await this.bridgeContract.withdrawErc20({
        authority: publicKey,
        requestIdBytes,
        erc20AddressBytes,
        amount: amountBN,
        recipientAddressBytes,
        evmParams,
      });

      // Notify relayer to monitor for this withdrawal with exact transaction parameters
      await this.relayerService.notifyWithdrawal({
        requestId,
        erc20Address,
        // Pass the exact transaction parameters used for signing
        transactionParams: {
          type: tempTx.type,
          chainId: tempTx.chainId,
          nonce: tempTx.nonce,
          maxPriorityFeePerGas: tempTx.maxPriorityFeePerGas.toString(),
          maxFeePerGas: tempTx.maxFeePerGas.toString(),
          gasLimit: tempTx.gasLimit.toString(),
          to: tempTx.to,
          value: tempTx.value.toString(),
          data: callData,
        },
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
