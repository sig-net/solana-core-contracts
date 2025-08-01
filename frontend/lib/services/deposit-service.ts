import { PublicKey } from '@solana/web3.js';
import { Wallet } from '@coral-xyz/anchor';

import { BridgeContract } from '@/lib/contracts/bridge-contract';
import { CryptographyService } from '@/lib/services/cryptography-service';
import { TokenBalanceService } from '@/lib/services/token-balance-service';
import { RelayerService } from '@/lib/services/relayer-service';
import type { DepositStatusCallback } from '@/lib/types/shared.types';
import { CHAIN_SIGNATURES_CONFIG } from '@/lib/constants/chain-signatures.constants';

/**
 * DepositService shows users where to deposit ERC20 tokens on Ethereum.
 * The relayer monitors Ethereum and handles Solana bridge calls automatically.
 */
export class DepositService {
  private relayerService: RelayerService;

  constructor(
    private bridgeContract: BridgeContract,
    private tokenBalanceService: TokenBalanceService,
    private wallet: Wallet,
  ) {
    this.relayerService = new RelayerService();
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
    try {
      const [vaultAuthority] =
        this.bridgeContract.deriveVaultAuthorityPda(publicKey);
      const path = publicKey.toString();
      const derivedAddress = CryptographyService.deriveEthereumAddress(
        path,
        vaultAuthority.toString(),
        CHAIN_SIGNATURES_CONFIG.BASE_PUBLIC_KEY,
      );

      console.log('Derived address:', derivedAddress);

      // Notify relayer to monitor for this deposit
      await this.relayerService.notifyDeposit({
        userAddress: publicKey.toString(),
        erc20Address,
        ethereumAddress: derivedAddress,
      });

      onStatusChange?.({
        status: 'relayer_processing',
        note: `Deposit ${amount} tokens to: ${derivedAddress}. Relayer will handle the bridge process.`,
      });

      // Return the derived address as the "request ID" for tracking
      return derivedAddress;
    } catch (error) {
      console.error('Deposit ERC20 failed:', error);
      throw new Error(
        `Failed to initiate deposit: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
