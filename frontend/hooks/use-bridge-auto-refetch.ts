'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useMemo } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useQueryClient } from '@tanstack/react-query';
import type { Wallet } from '@coral-xyz/anchor';

import {
  BRIDGE_PROGRAM_ID,
  deriveUserBalancePda,
  deriveVaultAuthorityPda,
} from '@/lib/constants/addresses';
import { getAllErc20Tokens } from '@/lib/constants/token-metadata';
import { queryKeys } from '@/lib/query-client';
import { BridgeContract } from '@/lib/contracts/bridge-contract';

/**
 * useBridgeAutoRefetch subscribes to on-chain logs for our program and
 * invalidates React Query caches when relevant instructions finalize.
 *
 * This provides near-real-time updates for:
 * - Deposits: claimErc20
 * - Withdrawals: completeWithdrawErc20
 */
export function useBridgeAutoRefetch() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, signAllTransactions } = useWallet();
  const queryClient = useQueryClient();

  // Precompute all userBalance PDAs for the current user across known tokens
  const userBalancePdaSet = useMemo(() => {
    if (!publicKey) return new Set<string>();
    const set = new Set<string>();
    for (const token of getAllErc20Tokens()) {
      try {
        const erc20Bytes = Buffer.from(token.address.replace('0x', ''), 'hex');
        const [pda] = deriveUserBalancePda(publicKey, erc20Bytes);
        set.add(pda.toBase58());
      } catch {
        // ignore invalid token entries
      }
    }
    return set;
  }, [publicKey]);

  // User's vault authority PDA (used by depositErc20)
  const requesterPdaBase58 = useMemo(() => {
    if (!publicKey) return null;
    try {
      const [pda] = deriveVaultAuthorityPda(publicKey);
      return pda.toBase58();
    } catch {
      return null;
    }
  }, [publicKey]);

  // Instantiate a lightweight BridgeContract for tx decoding needs if required later
  const bridgeContract = useMemo(() => {
    if (!publicKey) return null;
    const anchorWallet: Wallet = {
      publicKey,
      signTransaction,
      signAllTransactions,
      payer: publicKey
        ? ({ publicKey } as unknown as { publicKey: PublicKey })
        : undefined,
    } as unknown as Wallet;
    return new BridgeContract(connection, anchorWallet);
  }, [connection, publicKey, signTransaction, signAllTransactions]);

  useEffect(() => {
    if (!publicKey) return;

    // Subscribe to program logs at processed commitment for fastest UI updates
    const subId = connection.onLogs(
      BRIDGE_PROGRAM_ID,
      async logs => {
        try {
          const raw = logs.logs.join('\n');
          // Fast-path check for relevant instructions
          const isWithdrawComplete = raw.includes(
            'Instruction: completeWithdrawErc20',
          );
          const isDepositClaim = raw.includes('Instruction: claimErc20');
          const isWithdrawInit = raw.includes('Instruction: withdrawErc20');
          const isDepositInit = raw.includes('Instruction: depositErc20');
          if (
            !isWithdrawComplete &&
            !isDepositClaim &&
            !isWithdrawInit &&
            !isDepositInit
          )
            return;

          // Immediate invalidation for completions to keep UI snappy,
          // followed by a small delayed re-invalidation to catch commitment upgrades
          if (isDepositClaim || isWithdrawComplete) {
            const pkFast = publicKey.toString();
            queryClient.invalidateQueries({
              queryKey: queryKeys.solana.userBalances(pkFast),
            });
            queryClient.invalidateQueries({
              queryKey: queryKeys.solana.incomingDeposits(pkFast),
            });
            queryClient.invalidateQueries({
              queryKey: queryKeys.solana.outgoingTransfers(pkFast),
            });
            setTimeout(() => {
              queryClient.invalidateQueries({
                queryKey: queryKeys.solana.userBalances(pkFast),
              });
              queryClient.invalidateQueries({
                queryKey: queryKeys.solana.incomingDeposits(pkFast),
              });
            }, 1500);
          }

          // Fetch transaction to inspect account keys; filter to this user by PDA presence
          const tx = await connection.getTransaction(logs.signature, {
            maxSupportedTransactionVersion: 0,
            commitment: 'confirmed',
          });
          if (!tx) return;

          const accountKeys = tx.transaction.message.staticAccountKeys.map(k =>
            k.toBase58(),
          );

          // Filter to this user depending on instruction type
          const touchesUserBalance =
            userBalancePdaSet.size > 0 &&
            accountKeys.some(k => userBalancePdaSet.has(k));
          const touchesRequesterPda = requesterPdaBase58
            ? accountKeys.includes(requesterPdaBase58)
            : false;

          const relevant =
            // Balance-changing completions
            isWithdrawComplete || isDepositClaim
              ? touchesUserBalance
              : // Pending entries: withdraw uses userBalance, deposit uses requesterPda
                (isWithdrawInit && touchesUserBalance) ||
                (isDepositInit && touchesRequesterPda);

          if (!relevant) return;

          const pk = publicKey.toString();

          // Invalidate relevant queries immediately
          // For both deposit claim and withdraw complete we refresh balances and history
          queryClient.invalidateQueries({
            queryKey: queryKeys.solana.userBalances(pk),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.solana.unclaimedBalances(pk),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.solana.outgoingTransfers(pk),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.solana.incomingDeposits(pk),
          });
        } catch (e) {
          console.error('[BridgeAutoRefetch] log handler error:', e);
        }
      },
      'processed',
    );

    return () => {
      try {
        connection.removeOnLogsListener(subId).catch(() => {});
      } catch {}
    };
  }, [
    connection,
    publicKey,
    userBalancePdaSet,
    requesterPdaBase58,
    queryClient,
    bridgeContract,
  ]);
}
