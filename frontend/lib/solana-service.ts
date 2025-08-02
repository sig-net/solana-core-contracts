import { Connection, PublicKey } from '@solana/web3.js';
import { Wallet } from '@coral-xyz/anchor';

import { BridgeContract } from '@/lib/contracts/bridge-contract';
import { CryptographyService } from '@/lib/services/cryptography-service';
import { TokenBalanceService } from '@/lib/services/token-balance-service';

import { CHAIN_SIGNATURES_CONFIG } from './constants/chain-signatures.constants';

export class SolanaService {
  private bridgeContract: BridgeContract;
  private tokenBalanceService: TokenBalanceService;

  constructor(
    connection: Connection,
    private wallet: Wallet,
  ) {
    this.bridgeContract = new BridgeContract(connection, wallet);
    this.tokenBalanceService = new TokenBalanceService(this.bridgeContract);
  }

  async deriveDepositAddress(publicKey: PublicKey): Promise<string> {
    const [vaultAuthority] =
      this.bridgeContract.deriveVaultAuthorityPda(publicKey);

    const path = publicKey.toString();
    return CryptographyService.deriveEthereumAddress(
      path,
      vaultAuthority.toString(),
      CHAIN_SIGNATURES_CONFIG.BASE_PUBLIC_KEY,
    );
  }

  /**
   * Get available balance for a specific token, adjusted for contract constraints
   * Returns both the formatted amount and the actual decimals used
   */
  async getAdjustedAvailableBalance(
    publicKey: PublicKey,
    erc20Address: string,
  ): Promise<{ amount: string; decimals: number }> {
    const [vaultAuthority] =
      this.bridgeContract.deriveVaultAuthorityPda(publicKey);

    return this.tokenBalanceService.getAdjustedAvailableBalanceByPublicKey(
      publicKey,
      erc20Address,
      vaultAuthority,
      CHAIN_SIGNATURES_CONFIG.BASE_PUBLIC_KEY,
    );
  }
}
