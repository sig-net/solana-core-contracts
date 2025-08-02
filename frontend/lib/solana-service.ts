import { Connection, PublicKey } from '@solana/web3.js';
import { Wallet } from '@coral-xyz/anchor';

import type {
  TokenBalance,
  UnclaimedTokenBalance,
} from '@/lib/types/token.types';
import { BridgeContract } from '@/lib/contracts/bridge-contract';
import { ChainSignaturesContract } from '@/lib/contracts/chain-signatures-contract';
import { CryptographyService } from '@/lib/services/cryptography-service';
import { TokenBalanceService } from '@/lib/services/token-balance-service';
import { WithdrawalService } from '@/lib/services/withdrawal-service';

import { CHAIN_SIGNATURES_CONFIG } from './constants/chain-signatures.constants';

export class SolanaService {
  private bridgeContract: BridgeContract;
  private chainSignaturesContract: ChainSignaturesContract;
  private tokenBalanceService: TokenBalanceService;
  private withdrawalService: WithdrawalService;

  constructor(
    connection: Connection,
    private wallet: Wallet,
  ) {
    this.bridgeContract = new BridgeContract(connection, wallet);
    this.chainSignaturesContract = new ChainSignaturesContract(
      connection,
      wallet,
    );
    this.tokenBalanceService = new TokenBalanceService(this.bridgeContract);
    this.withdrawalService = new WithdrawalService(
      this.bridgeContract,
      this.tokenBalanceService,
    );
  }

  async getTokenDecimals(erc20Address: string): Promise<number> {
    return this.tokenBalanceService.getTokenDecimals(erc20Address);
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

  async fetchUnclaimedBalances(
    publicKey: PublicKey,
  ): Promise<UnclaimedTokenBalance[]> {
    const derivedAddress = await this.deriveDepositAddress(publicKey);
    return this.tokenBalanceService.fetchUnclaimedBalances(derivedAddress);
  }

  async fetchUserBalances(publicKey: PublicKey): Promise<TokenBalance[]> {
    return this.tokenBalanceService.fetchUserBalances(publicKey);
  }

  async fetchUserBalance(
    publicKey: PublicKey,
    erc20Address: string,
  ): Promise<string> {
    return this.tokenBalanceService.fetchUserBalance(publicKey, erc20Address);
  }

  /**
   * Fetch all user withdrawals (pending + historical)
   */
  async fetchAllUserWithdrawals(publicKey: PublicKey) {
    return this.withdrawalService.fetchAllUserWithdrawals(publicKey);
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
