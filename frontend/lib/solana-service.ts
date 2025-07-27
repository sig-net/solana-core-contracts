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
import { DepositService } from '@/lib/services/deposit-service';
import { WithdrawalService } from '@/lib/services/withdrawal-service';

import { CHAIN_SIGNATURES_CONFIG } from './constants/chain-signatures.constants';

export class SolanaService {
  private bridgeContract: BridgeContract;
  private chainSignaturesContract: ChainSignaturesContract;
  private tokenBalanceService: TokenBalanceService;
  private depositService: DepositService;
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
    this.depositService = new DepositService(
      this.bridgeContract,
      this.chainSignaturesContract,
      this.tokenBalanceService,
      wallet,
    );
    this.withdrawalService = new WithdrawalService(
      this.bridgeContract,
      this.chainSignaturesContract,
      this.tokenBalanceService,
      wallet,
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
    return this.depositService.depositErc20(
      publicKey,
      erc20Address,
      amount,
      _decimals,
      onStatusChange,
    );
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
    return this.withdrawalService.withdraw(
      publicKey,
      erc20Address,
      amount,
      recipientAddress,
      onStatusChange,
    );
  }

  async claimErc20(publicKey: PublicKey, requestId: string): Promise<string> {
    return this.depositService.claimErc20(publicKey, requestId);
  }

  async completeWithdraw(
    publicKey: PublicKey,
    requestId: string,
    erc20Address: string,
  ): Promise<string> {
    return this.withdrawalService.completeWithdraw(
      publicKey,
      requestId,
      erc20Address,
    );
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
