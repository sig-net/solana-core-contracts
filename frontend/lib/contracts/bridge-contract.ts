import {
  Connection,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from '@solana/web3.js';
import { Program, AnchorProvider, BN, Wallet } from '@coral-xyz/anchor';

import { IDL, type SolanaCoreContracts } from '@/lib/program/idl';
import {
  BRIDGE_PROGRAM_ID,
  BRIDGE_PDA_SEEDS,
} from '@/lib/constants/bridge.constants';
import { CHAIN_SIGNATURES_PROGRAM_ID } from '@/lib/constants/chain-signatures.constants';
import { SYSTEM_PROGRAM_ID } from '@/lib/constants/service.constants';

/**
 * BridgeContract class handles all low-level contract interactions,
 * PDA derivations, and account management for the bridge program.
 */
export class BridgeContract {
  private program: Program<SolanaCoreContracts> | null = null;

  constructor(
    private connection: Connection,
    private wallet: Wallet,
  ) {}

  /**
   * Get the bridge program instance
   */
  private getBridgeProgram(): Program<SolanaCoreContracts> {
    if (!this.program) {
      const provider = new AnchorProvider(this.connection, this.wallet, {
        commitment: 'confirmed',
      });
      this.program = new Program(IDL, provider);
    }
    return this.program;
  }

  /**
   * Reset the program instance (useful when wallet changes)
   */
  resetProgram(): void {
    this.program = null;
  }

  // ================================
  // PDA Derivation Methods
  // ================================

  /**
   * Derive vault authority PDA for a given user
   */
  deriveVaultAuthorityPda(userPublicKey: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(BRIDGE_PDA_SEEDS.VAULT_AUTHORITY), userPublicKey.toBuffer()],
      BRIDGE_PROGRAM_ID,
    );
  }

  /**
   * Derive pending deposit PDA for a given request ID
   */
  derivePendingDepositPda(requestIdBytes: number[]): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(BRIDGE_PDA_SEEDS.PENDING_ERC20_DEPOSIT),
        Buffer.from(requestIdBytes),
      ],
      BRIDGE_PROGRAM_ID,
    );
  }

  /**
   * Derive pending withdrawal PDA for a given request ID
   */
  derivePendingWithdrawalPda(requestIdBytes: number[]): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(BRIDGE_PDA_SEEDS.PENDING_ERC20_WITHDRAWAL),
        Buffer.from(requestIdBytes),
      ],
      BRIDGE_PROGRAM_ID,
    );
  }

  /**
   * Derive global vault authority PDA
   */
  deriveGlobalVaultAuthorityPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(BRIDGE_PDA_SEEDS.GLOBAL_VAULT_AUTHORITY)],
      BRIDGE_PROGRAM_ID,
    );
  }

  /**
   * Derive user balance PDA for a given user and ERC20 token
   */
  deriveUserBalancePda(
    userPublicKey: PublicKey,
    erc20AddressBytes: Buffer,
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(BRIDGE_PDA_SEEDS.USER_ERC20_BALANCE),
        userPublicKey.toBuffer(),
        erc20AddressBytes,
      ],
      BRIDGE_PROGRAM_ID,
    );
  }

  /**
   * Derive chain signatures state PDA
   */
  deriveChainSignaturesStatePda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(BRIDGE_PDA_SEEDS.PROGRAM_STATE)],
      CHAIN_SIGNATURES_PROGRAM_ID,
    );
  }

  // ================================
  // Account Fetching Methods
  // ================================

  /**
   * Fetch pending deposit account data
   */
  async fetchPendingDeposit(pendingDepositPda: PublicKey) {
    return await this.getBridgeProgram().account.pendingErc20Deposit.fetch(
      pendingDepositPda,
    );
  }

  /**
   * Check if pending deposit exists
   */
  async checkPendingDepositExists(
    pendingDepositPda: PublicKey,
  ): Promise<boolean> {
    const accountInfo = await this.connection.getAccountInfo(pendingDepositPda);
    return accountInfo !== null;
  }

  /**
   * Fetch user balance for a specific ERC20 token
   */
  async fetchUserBalance(
    userPublicKey: PublicKey,
    erc20Address: string,
  ): Promise<string> {
    try {
      const erc20Bytes = Buffer.from(erc20Address.replace('0x', ''), 'hex');
      const [userBalancePda] = this.deriveUserBalancePda(
        userPublicKey,
        erc20Bytes,
      );

      const accountInfo = await this.connection.getAccountInfo(userBalancePda);

      if (!accountInfo) {
        return '0';
      }

      if (!accountInfo.owner.equals(BRIDGE_PROGRAM_ID)) {
        throw new Error('Account is not owned by the expected program');
      }

      const data = accountInfo.data;
      const amountBytes = data.subarray(8, 24);
      let amount = BigInt(0);

      for (let i = 0; i < 16; i++) {
        amount |= BigInt(amountBytes[i]) << BigInt(i * 8);
      }

      return amount.toString();
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Account does not exist')
      ) {
        return '0';
      }
      throw new Error(
        `Failed to fetch user balance: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // ================================
  // Contract Method Calls
  // ================================

  /**
   * Call depositErc20 method with all accounts prepared
   */
  async depositErc20({
    authority,
    requestIdBytes,
    erc20AddressBytes,
    amount,
    evmParams,
  }: {
    authority: PublicKey;
    requestIdBytes: number[];
    erc20AddressBytes: number[];
    amount: BN;
    evmParams: any;
  }): Promise<string> {
    const [vaultAuthority] = this.deriveVaultAuthorityPda(authority);
    const [pendingDepositPda] = this.derivePendingDepositPda(requestIdBytes);
    const [chainSignaturesStatePda] = this.deriveChainSignaturesStatePda();

    return await this.getBridgeProgram()
      .methods.depositErc20(
        requestIdBytes,
        erc20AddressBytes,
        amount,
        evmParams,
      )
      .accounts({
        authority,
        requester: vaultAuthority,
        pendingDeposit: pendingDepositPda,
        feePayer: authority,
        chainSignaturesState: chainSignaturesStatePda,
        chainSignaturesProgram: CHAIN_SIGNATURES_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      } as any)
      .rpc();
  }

  /**
   * Call claimErc20 method with all accounts prepared
   */
  async claimErc20({
    authority,
    requestIdBytes,
    serializedOutput,
    signature,
    erc20AddressBytes,
  }: {
    authority: PublicKey;
    requestIdBytes: number[];
    serializedOutput: number[];
    signature: any;
    erc20AddressBytes: number[];
  }): Promise<string> {
    const [pendingDepositPda] = this.derivePendingDepositPda(requestIdBytes);
    const erc20Bytes = Buffer.from(erc20AddressBytes);
    const [userBalancePda] = this.deriveUserBalancePda(authority, erc20Bytes);

    return await this.getBridgeProgram()
      .methods.claimErc20(
        Array.from(requestIdBytes),
        serializedOutput,
        signature,
      )
      .accounts({
        authority,
        pendingDeposit: pendingDepositPda,
        userBalance: userBalancePda,
        systemProgram: SYSTEM_PROGRAM_ID,
      } as any)
      .rpc();
  }

  /**
   * Initiate ERC20 withdrawal
   */
  async withdrawErc20({
    authority,
    requestIdBytes,
    erc20AddressBytes,
    amount,
    recipientAddressBytes,
    evmParams,
  }: {
    authority: PublicKey;
    requestIdBytes: number[];
    erc20AddressBytes: number[];
    amount: BN;
    recipientAddressBytes: number[];
    evmParams: any;
  }): Promise<string> {
    const [globalVaultAuthority] = this.deriveGlobalVaultAuthorityPda();
    const [pendingWithdrawalPda] =
      this.derivePendingWithdrawalPda(requestIdBytes);
    const erc20Bytes = Buffer.from(erc20AddressBytes);
    const [userBalancePda] = this.deriveUserBalancePda(authority, erc20Bytes);

    return await this.getBridgeProgram()
      .methods.withdrawErc20(
        Array.from(requestIdBytes),
        Array.from(erc20AddressBytes),
        amount,
        Array.from(recipientAddressBytes),
        evmParams,
      )
      .accounts({
        authority,
        requester: globalVaultAuthority,
        pendingWithdrawal: pendingWithdrawalPda,
        userBalance: userBalancePda,
        chainSignaturesState: this.deriveChainSignaturesStatePda()[0],
        chainSignaturesProgram: CHAIN_SIGNATURES_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      } as any)
      .rpc();
  }

  /**
   * Complete ERC20 withdrawal
   */
  async completeWithdrawErc20({
    authority,
    requestIdBytes,
    serializedOutput,
    signature,
    erc20AddressBytes,
  }: {
    authority: PublicKey;
    requestIdBytes: number[];
    serializedOutput: number[];
    signature: any;
    erc20AddressBytes: number[];
  }): Promise<string> {
    const [globalVaultAuthority] = this.deriveGlobalVaultAuthorityPda();
    const [pendingWithdrawalPda] =
      this.derivePendingWithdrawalPda(requestIdBytes);
    const erc20Bytes = Buffer.from(erc20AddressBytes);
    const [userBalancePda] = this.deriveUserBalancePda(authority, erc20Bytes);

    return await this.getBridgeProgram()
      .methods.completeWithdrawErc20(
        Array.from(requestIdBytes),
        serializedOutput,
        signature,
      )
      .accounts({
        authority,
        requester: globalVaultAuthority,
        pendingWithdrawal: pendingWithdrawalPda,
        userBalance: userBalancePda,
        chainSignaturesState: this.deriveChainSignaturesStatePda()[0],
        chainSignaturesProgram: CHAIN_SIGNATURES_PROGRAM_ID,
        systemProgram: SYSTEM_PROGRAM_ID,
      } as any)
      .rpc();
  }

  /**
   * Fetch pending withdrawal details
   */
  async fetchPendingWithdrawal(pendingWithdrawalPda: PublicKey): Promise<any> {
    return await this.getBridgeProgram().account.pendingErc20Withdrawal.fetch(
      pendingWithdrawalPda,
    );
  }

  /**
   * Check if pending withdrawal exists
   */
  async checkPendingWithdrawalExists(
    pendingWithdrawalPda: PublicKey,
  ): Promise<boolean> {
    try {
      await this.fetchPendingWithdrawal(pendingWithdrawalPda);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Fetch all pending withdrawals for a user
   */
  async fetchUserPendingWithdrawals(userPublicKey: PublicKey): Promise<any[]> {
    try {
      const program = this.getBridgeProgram();
      
      // Query all pendingErc20Withdrawal accounts where requester matches user
      const pendingWithdrawals = await program.account.pendingErc20Withdrawal.all([
        {
          memcmp: {
            offset: 8, // Skip the 8-byte discriminator
            bytes: userPublicKey.toBase58(),
          },
        },
      ]);
      
      return pendingWithdrawals;
    } catch (error) {
      console.error('Error fetching user pending withdrawals:', error);
      return [];
    }
  }

  // ================================
  // Helper Methods
  // ================================

  /**
   * Convert hex string to bytes array
   */
  hexToBytes(hex: string): number[] {
    const cleanHex = hex.replace('0x', '');
    return Array.from(Buffer.from(cleanHex, 'hex'));
  }

  /**
   * Convert ERC20 address to bytes
   */
  erc20AddressToBytes(erc20Address: string): number[] {
    return Array.from(Buffer.from(erc20Address.slice(2), 'hex'));
  }

  /**
   * Get program ID
   */
  get programId(): PublicKey {
    return BRIDGE_PROGRAM_ID;
  }
}
