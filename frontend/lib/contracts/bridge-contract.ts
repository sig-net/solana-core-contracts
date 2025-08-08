import { Buffer } from 'buffer';

import {
  Connection,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from '@solana/web3.js';
import { Program, AnchorProvider, BN, Wallet } from '@coral-xyz/anchor';

import { IDL, type SolanaCoreContracts } from '@/lib/program/IDL_SOLANA_DEX';
import type { EvmTransactionProgramParams } from '@/lib/types/shared.types';
import {
  BRIDGE_PROGRAM_ID,
  BRIDGE_PDA_SEEDS,
  CHAIN_SIGNATURES_PROGRAM_ID,
  deriveEthereumAddress,
  CHAIN_SIGNATURES_CONFIG,
  GLOBAL_VAULT_AUTHORITY_PDA,
} from '@/lib/constants/addresses';
import { getAllErc20Tokens } from '@/lib/constants/token-metadata';

import { ChainSignaturesSignature } from '../types/chain-signatures.types';

/**
 * BridgeContract class handles all low-level contract interactions,
 * PDA derivations, and account management for the cross-chain wallet program.
 */
export class BridgeContract {
  private program: Program<SolanaCoreContracts> | null = null;

  constructor(
    private connection: Connection,
    private wallet: Wallet,
  ) {}

  /**
   * Get the core contracts program instance
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
   * Fetch user balance for a specific ERC20 token using Anchor deserialization
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

      // Use Anchor's account fetching mechanism instead of manual parsing
      const userBalanceAccount =
        await this.getBridgeProgram().account.userErc20Balance.fetchNullable(
          userBalancePda,
        );

      if (!userBalanceAccount) {
        return '0';
      }

      // Access the amount field directly from the deserialized account
      return userBalanceAccount.amount.toString();
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('Account does not exist') ||
          error.message.includes('AccountNotFound'))
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
    requester,
    payer,
    requestIdBytes,
    erc20AddressBytes,
    amount,
    evmParams,
  }: {
    requester: PublicKey;
    payer?: PublicKey;
    requestIdBytes: number[];
    erc20AddressBytes: number[];
    amount: BN;
    evmParams: EvmTransactionProgramParams;
  }): Promise<string> {
    const payerKey = payer;
    const [requesterPda] = this.deriveVaultAuthorityPda(requester);
    const [pendingDepositPda] = this.derivePendingDepositPda(requestIdBytes);
    const [chainSignaturesStatePda] = this.deriveChainSignaturesStatePda();

    return await this.getBridgeProgram()
      .methods.depositErc20(
        requestIdBytes,
        requester,
        erc20AddressBytes,
        amount,
        evmParams,
      )
      .accounts({
        payer: payerKey,
        requesterPda: requesterPda,
        pendingDeposit: pendingDepositPda,
        feePayer: payerKey,
        chainSignaturesState: chainSignaturesStatePda,
        chainSignaturesProgram: CHAIN_SIGNATURES_PROGRAM_ID,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      } as any)
      .rpc();
  }

  /**
   * Call claimErc20 method with all accounts prepared
   */
  async claimErc20({
    payer,
    requestIdBytes,
    serializedOutput,
    signature,
    erc20AddressBytes,
    requester,
  }: {
    payer?: PublicKey;
    requestIdBytes: number[];
    serializedOutput: number[];
    signature: ChainSignaturesSignature;
    erc20AddressBytes: number[];
    requester: PublicKey;
  }): Promise<string> {
    const payerKey = payer || this.wallet.publicKey;
    const [pendingDepositPda] = this.derivePendingDepositPda(requestIdBytes);
    const erc20Bytes = Buffer.from(erc20AddressBytes);
    const [userBalancePda] = this.deriveUserBalancePda(requester, erc20Bytes);

    return await this.getBridgeProgram()
      .methods.claimErc20(
        Array.from(requestIdBytes),
        serializedOutput,
        signature,
      )
      .accounts({
        payer: payerKey,
        pendingDeposit: pendingDepositPda,
        userBalance: userBalancePda,
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
    evmParams: EvmTransactionProgramParams;
  }): Promise<string> {
    const globalVaultAuthority = GLOBAL_VAULT_AUTHORITY_PDA;
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
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      } as any)
      .rpc();
  }

  /**
   * Complete ERC20 withdrawal
   */
  async completeWithdrawErc20({
    payer,
    requestIdBytes,
    serializedOutput,
    signature,
    erc20AddressBytes,
    requester,
  }: {
    payer?: PublicKey;
    requestIdBytes: number[];
    serializedOutput: number[];
    signature: ChainSignaturesSignature;
    erc20AddressBytes: number[];
    requester: PublicKey;
  }): Promise<string> {
    const payerKey = payer || this.wallet.publicKey;
    const [pendingWithdrawalPda] =
      this.derivePendingWithdrawalPda(requestIdBytes);
    const erc20Bytes = Buffer.from(erc20AddressBytes);
    const [userBalancePda] = this.deriveUserBalancePda(requester, erc20Bytes);

    return await this.getBridgeProgram()
      .methods.completeWithdrawErc20(
        Array.from(requestIdBytes),
        serializedOutput,
        signature,
      )
      .accounts({
        payer: payerKey,
        pendingWithdrawal: pendingWithdrawalPda,
        userBalance: userBalancePda,
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
   * Fetch comprehensive user withdrawal data by combining multiple sources
   */
  async fetchAllUserWithdrawals(userPublicKey: PublicKey): Promise<
    {
      requestId: string;
      amount: string;
      erc20Address: string;
      recipient: string;
      status: 'pending' | 'completed';
      timestamp: number;
      signature?: string;
      ethereumTxHash?: string;
    }[]
  > {
    try {
      const withdrawals: {
        requestId: string;
        amount: string;
        erc20Address: string;
        recipient: string;
        status: 'pending' | 'completed';
        timestamp: number;
        signature?: string;
        ethereumTxHash?: string;
      }[] = [];

      // Get historical transactions by parsing user's transaction history
      try {
        const signatures = await this.connection.getSignaturesForAddress(
          userPublicKey,
          { limit: 50 }, // Get last 50 transactions
        );

        const program = this.getBridgeProgram();
        const coder = program.coder;

        for (const sig of signatures) {
          try {
            const tx = await this.connection.getTransaction(sig.signature, {
              maxSupportedTransactionVersion: 0,
            });

            if (!tx || !tx.meta || tx.meta.err) continue;

            // Check if this transaction involves the core contracts program
            const accountKeys = tx.transaction.message.staticAccountKeys;

            // Find instructions for our program
            const instructions = tx.transaction.message.compiledInstructions;

            for (const ix of instructions) {
              const programId = accountKeys[ix.programIdIndex];

              if (programId.equals(BRIDGE_PROGRAM_ID)) {
                try {
                  // Get instruction data as Buffer
                  const instructionDataBuf = Buffer.from(ix.data, 'base64');

                  // Use Anchor's coder to decode the instruction
                  let decodedInstruction: {
                    name: string;
                    data: any;
                  } | null = null;

                  try {
                    decodedInstruction =
                      coder.instruction.decode(instructionDataBuf);
                  } catch (decodeError) {
                    // Skip instructions we can't decode
                    continue;
                  }

                  if (!decodedInstruction) continue;

                  const { name: instructionName, data: decodedData } =
                    decodedInstruction;

                  // Handle withdrawErc20 instruction
                  if (instructionName === 'withdrawErc20') {
                    // Extract withdrawal data using IDL-decoded structure
                    const requestId = Buffer.from(
                      decodedData.requestId,
                    ).toString('hex');
                    const erc20Address =
                      '0x' +
                      Buffer.from(decodedData.erc20Address).toString('hex');
                    const amount = decodedData.amount.toString();
                    const recipient =
                      '0x' +
                      Buffer.from(decodedData.recipientAddress).toString('hex');

                    // Check if this withdrawal is for the current user
                    const userAccountIndex = accountKeys.findIndex(key =>
                      key.equals(userPublicKey),
                    );

                    // Get instruction accounts
                    const ixAccounts = ix.accountKeyIndexes;

                    if (
                      userAccountIndex !== -1 &&
                      ixAccounts.includes(userAccountIndex)
                    ) {
                      const withdrawalRecord = {
                        requestId,
                        amount,
                        erc20Address,
                        recipient,
                        status: 'pending' as const,
                        timestamp: sig.blockTime || Date.now() / 1000,
                        signature: sig.signature,
                        ethereumTxHash: undefined,
                      };

                      // Only add if not already in withdrawals list
                      const exists = withdrawals.some(
                        w => w.requestId === requestId,
                      );
                      if (!exists) {
                        withdrawals.push(withdrawalRecord);
                      }
                    }
                  }
                  // Handle completeWithdrawErc20 instruction
                  else if (instructionName === 'completeWithdrawErc20') {
                    const requestId = Buffer.from(
                      decodedData.requestId,
                    ).toString('hex');

                    // Update existing withdrawal to completed status if found
                    const existingIndex = withdrawals.findIndex(
                      w => w.requestId === requestId,
                    );
                    if (existingIndex !== -1) {
                      withdrawals[existingIndex].status = 'completed';
                    }
                  }
                } catch (decodeError) {
                  // Skip instructions we can't decode
                  continue;
                }
              }
            }
          } catch (error) {
            // Skip failed transaction parsing
            console.error('Error parsing transaction:', error);
            continue;
          }
        }
      } catch (error) {
        console.error('Error fetching transaction history:', error);
      }

      // Sort by timestamp (newest first)
      return withdrawals.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Error fetching all user withdrawals:', error);
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
   * Derive deposit address for a given user public key
   * This replaces the SolanaService.deriveDepositAddress method
   */
  deriveDepositAddress(publicKey: PublicKey): string {
    const [vaultAuthority] = this.deriveVaultAuthorityPda(publicKey);
    const path = publicKey.toString();
    return deriveEthereumAddress(
      path,
      vaultAuthority.toString(),
      CHAIN_SIGNATURES_CONFIG.BASE_PUBLIC_KEY,
    );
  }

  /**
   * Fetch recent claimErc20 events for a user and map them to ERC20 token addresses with timestamps
   */
  async fetchRecentUserClaims(
    userPublicKey: PublicKey,
    maxTransactions = 50,
  ): Promise<Record<string, number>> {
    try {
      const claimsByToken: Record<string, number> = {};

      const signatures = await this.connection.getSignaturesForAddress(
        userPublicKey,
        { limit: maxTransactions },
      );

      const program = this.getBridgeProgram();
      const coder = program.coder;

      for (const sig of signatures) {
        try {
          const tx = await this.connection.getTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0,
          });
          if (!tx || !tx.meta || tx.meta.err) continue;

          const accountKeys = tx.transaction.message.staticAccountKeys;
          const instructions = tx.transaction.message.compiledInstructions;

          for (const ix of instructions) {
            const programId = accountKeys[ix.programIdIndex];
            if (!programId.equals(BRIDGE_PROGRAM_ID)) continue;

            let decodedInstruction: { name: string; data: unknown } | null =
              null;
            try {
              const instructionDataBuf = Buffer.from(ix.data);
              decodedInstruction = (coder.instruction as any).decode(
                instructionDataBuf,
              );
            } catch {
              continue;
            }
            if (!decodedInstruction) continue;

            if (decodedInstruction.name === 'claimErc20') {
              // userBalance is the 3rd account in claimErc20 accounts
              const userBalanceAccountIndex = ix.accountKeyIndexes[2];
              const userBalanceAccount = accountKeys[userBalanceAccountIndex];

              // Determine which token this userBalance PDA corresponds to
              for (const token of getAllErc20Tokens()) {
                const erc20Bytes = Buffer.from(
                  token.address.replace('0x', ''),
                  'hex',
                );
                const [expectedPda] = this.deriveUserBalancePda(
                  userPublicKey,
                  erc20Bytes,
                );
                if (expectedPda.equals(userBalanceAccount)) {
                  const ts = sig.blockTime || Math.floor(Date.now() / 1000);
                  // Record earliest claim time per token (or update if newer)
                  const existing = claimsByToken[token.address];
                  if (!existing || ts > existing) {
                    claimsByToken[token.address] = ts;
                  }
                  break;
                }
              }
            }
          }
        } catch {
          continue;
        }
      }

      return claimsByToken;
    } catch (error) {
      console.error('Error fetching recent user claims:', error);
      return {};
    }
  }

  /**
   * Fetch all user deposits (pending + completed) by scanning Solana transactions.
   * A deposit becomes "initiated" when depositErc20 is called (pending_erc20_deposit created).
   * It becomes "completed" when claimErc20 is executed for the same requestId.
   */
  async fetchAllUserDeposits(userPublicKey: PublicKey): Promise<
    {
      requestId: string;
      amount: string;
      erc20Address: string;
      timestamp: number;
      status: 'pending' | 'completed';
    }[]
  > {
    const deposits: Map<
      string,
      {
        requestId: string;
        amount: string;
        erc20Address: string;
        timestamp: number;
        status: 'pending' | 'completed';
      }
    > = new Map();

    try {
      const program = this.getBridgeProgram();
      const coder = program.coder;

      // 1) Scan requester PDA transactions for depositErc20
      const [requesterPda] = this.deriveVaultAuthorityPda(userPublicKey);
      const requesterSignatures = await this.connection.getSignaturesForAddress(
        requesterPda,
        {
          limit: 50,
        },
      );
      for (const sig of requesterSignatures) {
        try {
          const tx = await this.connection.getTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0,
          });
          if (!tx || !tx.meta || tx.meta.err) continue;
          const accountKeys = tx.transaction.message.staticAccountKeys;
          const instructions = tx.transaction.message.compiledInstructions;

          for (const ix of instructions) {
            const programId = accountKeys[ix.programIdIndex];
            if (!programId.equals(BRIDGE_PROGRAM_ID)) continue;
            let decodedInstruction: { name: string; data: any } | null = null;
            try {
              const instructionDataBuf = Buffer.from(ix.data, 'base64');
              decodedInstruction = coder.instruction.decode(instructionDataBuf);
            } catch {
              continue;
            }
            if (!decodedInstruction) continue;

            if (decodedInstruction.name === 'depositErc20') {
              const data = decodedInstruction.data as any;
              const requesterHex = new PublicKey(data.requester).toString();
              if (requesterHex !== userPublicKey.toString()) continue;

              const requestId = Buffer.from(data.requestId).toString('hex');
              const erc20Address =
                '0x' + Buffer.from(data.erc20Address).toString('hex');
              const amount = data.amount.toString();
              const timestamp = sig.blockTime || Math.floor(Date.now() / 1000);

              deposits.set(requestId, {
                requestId,
                amount,
                erc20Address,
                timestamp,
                status: 'pending',
              });
            }
          }
        } catch {
          continue;
        }
      }

      // 2) Scan user balance PDAs per token for claimErc20 and flip status
      for (const token of getAllErc20Tokens()) {
        try {
          const erc20Bytes = Buffer.from(
            token.address.replace('0x', ''),
            'hex',
          );
          const [userBalancePda] = this.deriveUserBalancePda(
            userPublicKey,
            erc20Bytes,
          );
          const signatures = await this.connection.getSignaturesForAddress(
            userBalancePda,
            { limit: 50 },
          );
          for (const sig of signatures) {
            try {
              const tx = await this.connection.getTransaction(sig.signature, {
                maxSupportedTransactionVersion: 0,
              });
              if (!tx || !tx.meta || tx.meta.err) continue;
              const accountKeys = tx.transaction.message.staticAccountKeys;
              const instructions = tx.transaction.message.compiledInstructions;
              for (const ix of instructions) {
                const programId = accountKeys[ix.programIdIndex];
                if (!programId.equals(BRIDGE_PROGRAM_ID)) continue;
                let decodedInstruction: { name: string; data: any } | null =
                  null;
                try {
                  const instructionDataBuf = Buffer.from(ix.data, 'base64');
                  decodedInstruction =
                    coder.instruction.decode(instructionDataBuf);
                } catch {
                  continue;
                }
                if (!decodedInstruction) continue;
                if (decodedInstruction.name === 'claimErc20') {
                  const data = decodedInstruction.data as any;
                  const requestId = Buffer.from(data.requestId).toString('hex');
                  const existing = deposits.get(requestId);
                  if (existing) {
                    existing.status = 'completed';
                    // Keep earliest deposit timestamp
                    deposits.set(requestId, existing);
                  }
                }
              }
            } catch {
              continue;
            }
          }
        } catch {
          continue;
        }
      }

      const list = Array.from(deposits.values()).sort(
        (a, b) => b.timestamp - a.timestamp,
      );
      return list;
    } catch (error) {
      console.error('Error fetching all user deposits:', error);
      return [];
    }
  }
}
