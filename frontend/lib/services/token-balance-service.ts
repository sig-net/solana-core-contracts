import { Connection, PublicKey } from '@solana/web3.js';
import { ethers } from 'ethers';

import type { TokenBalance } from '@/lib/types/token.types';
import {
  getTokenMetadata,
  getAllErc20Tokens,
  NETWORKS_WITH_TOKENS,
} from '@/lib/constants/token-metadata';
import type { BridgeContract } from '@/lib/contracts/bridge-contract';

import { getAlchemyProvider } from '../utils/providers';

/**
 * TokenBalanceService handles all token balance operations including
 * fetching and processing ERC20 token balances.
 */
export class TokenBalanceService {
  private static decimalsCache = new Map<
    string,
    { decimals: number; timestamp: number }
  >();
  private static readonly DECIMALS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private alchemy = getAlchemyProvider();

  constructor(private bridgeContract: BridgeContract) {}

  /**
   * Get token decimals from contract with caching
   */
  async getTokenDecimals(erc20Address: string): Promise<number> {
    const cacheKey = erc20Address.toLowerCase();
    const now = Date.now();

    // Check cache first
    const cached = TokenBalanceService.decimalsCache.get(cacheKey);
    if (
      cached &&
      now - cached.timestamp < TokenBalanceService.DECIMALS_CACHE_TTL
    ) {
      return cached.decimals;
    }

    try {
      const metadata = await this.alchemy.core.getTokenMetadata(erc20Address);
      const decimals = metadata?.decimals ?? 18;

      // Cache the result
      TokenBalanceService.decimalsCache.set(cacheKey, {
        decimals,
        timestamp: now,
      });
      return decimals;
    } catch (error) {
      console.warn(
        `[TOKEN_BALANCE] Failed to fetch decimals for ${erc20Address}:`,
        error,
      );

      // Fallback to hardcoded metadata
      const tokenMetadata = getTokenMetadata(erc20Address);
      const fallbackDecimals = tokenMetadata?.decimals || 18;

      // Cache fallback result with shorter TTL
      TokenBalanceService.decimalsCache.set(cacheKey, {
        decimals: fallbackDecimals,
        timestamp: now - TokenBalanceService.DECIMALS_CACHE_TTL * 0.8, // 80% TTL for fallbacks
      });

      return fallbackDecimals;
    }
  }

  /**
   * Batch fetch ERC20 balances for multiple tokens
   */
  async batchFetchErc20Balances(
    address: string,
    tokenAddresses: string[],
  ): Promise<Array<{ address: string; balance: bigint; decimals: number }>> {
    try {
      // Use Alchemy's getTokenBalances for efficient batch fetching
      const balances = await this.alchemy.core.getTokenBalances(
        address,
        tokenAddresses,
      );

      if (!balances) {
        return this.fallbackBatchFetch(address, tokenAddresses);
      }

      const results: Array<{
        address: string;
        balance: bigint;
        decimals: number;
      }> = [];

      for (const tokenBalance of balances.tokenBalances) {
        const balance = BigInt(tokenBalance.tokenBalance || '0');

        if (balance > BigInt(0)) {
          // Only fetch decimals for non-zero balances
          const decimals = await this.getTokenDecimals(
            tokenBalance.contractAddress,
          );
          results.push({
            address: tokenBalance.contractAddress,
            balance,
            decimals,
          });
        } else {
          // Include zero balances with default decimals
          results.push({
            address: tokenBalance.contractAddress,
            balance: BigInt(0),
            decimals: 18,
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error batch fetching token balances:', error);
      // Fallback to individual calls
      return this.fallbackBatchFetch(address, tokenAddresses);
    }
  }

  /**
   * Fallback method for individual balance fetching when batch fails
   */
  private async fallbackBatchFetch(
    address: string,
    tokenAddresses: string[],
  ): Promise<Array<{ address: string; balance: bigint; decimals: number }>> {
    const balancePromises = tokenAddresses.map(async tokenAddress => {
      try {
        const tokenBalances = await this.alchemy.core.getTokenBalances(
          address,
          [tokenAddress],
        );
        const balance = tokenBalances?.tokenBalances?.[0]?.tokenBalance || '0';
        const balanceBigInt = BigInt(balance || '0');

        if (balanceBigInt > BigInt(0)) {
          const decimals = await this.getTokenDecimals(tokenAddress);
          return { address: tokenAddress, balance: balanceBigInt, decimals };
        } else {
          return { address: tokenAddress, balance: BigInt(0), decimals: 18 };
        }
      } catch (error) {
        console.error(`Error fetching balance for ${tokenAddress}:`, error);
        return { address: tokenAddress, balance: BigInt(0), decimals: 18 };
      }
    });

    return Promise.all(balancePromises);
  }

  /**
   * Fetch unclaimed balances from derived Ethereum address
   */
  async fetchUnclaimedBalances(
    derivedAddress: string,
  ): Promise<TokenBalance[]> {
    try {
      const tokenAddresses = getAllErc20Tokens().map(token => token.address);

      // Use batch fetching to reduce RPC calls
      const batchResults = await this.batchFetchErc20Balances(
        derivedAddress,
        tokenAddresses,
      );

      const results: TokenBalance[] = [];

      for (const result of batchResults) {
        if (result.balance > BigInt(0)) {
          const tokenMetadata = getTokenMetadata(result.address);
          results.push({
            erc20Address: result.address,
            amount: result.balance.toString(),
            symbol: tokenMetadata?.symbol || 'Unknown',
            name: tokenMetadata?.name || 'Unknown Token',
            decimals: result.decimals,
            chain: tokenMetadata?.chain || 'ethereum',
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error fetching unclaimed balances:', error);
      return [];
    }
  }

  /**
   * Fetch user balances from Solana contract
   */
  async fetchUserBalances(publicKey: PublicKey): Promise<TokenBalance[]> {
    try {
      const tokenAddresses = getAllErc20Tokens().map(token => token.address);

      const balancesPromises = tokenAddresses.map(async erc20Address => {
        const balance = await this.bridgeContract.fetchUserBalance(
          publicKey,
          erc20Address,
        );
        if (balance !== '0') {
          const decimals = await this.getTokenDecimals(erc20Address);
          const tokenMetadata = getTokenMetadata(erc20Address);
          return {
            erc20Address,
            amount: balance,
            decimals,
            symbol: tokenMetadata?.symbol || 'Unknown',
            name: tokenMetadata?.name || 'Unknown Token',
            chain: tokenMetadata?.chain || 'ethereum',
          };
        }
        return null;
      });

      const erc20Results = (await Promise.all(balancesPromises)).filter(
        (result): result is TokenBalance => result !== null,
      );

      // Also include SPL balances for the user's own Solana wallet for tokens listed under Solana
      const connection: Connection = this.bridgeContract.getConnection();
      const solanaNetwork = NETWORKS_WITH_TOKENS.find(
        n => n.chain === 'solana',
      );

      const splResults: TokenBalance[] = [];
      if (solanaNetwork) {
        for (const token of solanaNetwork.tokens) {
          try {
            // Fetch associated token account balance; if token is native SOL (none here), we'd use getBalance
            // For USDC/USDT on Solana, we can use getParsedTokenAccountsByOwner
            const parsed = await connection.getParsedTokenAccountsByOwner(
              publicKey,
              { mint: new PublicKey(token.address) },
            );

            let amount = '0';
            if (parsed.value.length > 0) {
              const info = parsed.value[0].account.data as unknown as {
                parsed?: {
                  info?: { tokenAmount?: { amount?: string } };
                };
              };
              const tokenAmount = info.parsed?.info?.tokenAmount?.amount;
              amount = typeof tokenAmount === 'string' ? tokenAmount : '0';
            }

            // Always include, even if zero, so Solana assets display with user's own balance
            splResults.push({
              erc20Address: token.address, // reuse field for identifier
              amount,
              decimals: token.decimals,
              symbol: token.symbol,
              name: token.name,
              chain: 'solana',
            });
          } catch (e) {
            // If RPC fails for a token, still include zero balance entry
            splResults.push({
              erc20Address: token.address,
              amount: '0',
              decimals: token.decimals,
              symbol: token.symbol,
              name: token.name,
              chain: 'solana',
            });
          }
        }
      }

      return [...erc20Results, ...splResults];
    } catch (error) {
      console.error('Failed to fetch user balances:', error);
      throw new Error(
        `Failed to fetch user balances: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Fetch single user balance from Solana contract
   */
  async fetchUserBalance(
    publicKey: PublicKey,
    erc20Address: string,
  ): Promise<string> {
    return await this.bridgeContract.fetchUserBalance(publicKey, erc20Address);
  }

  /**
   * Get available balance for a specific token, adjusted for contract constraints
   * Returns both the formatted amount and the actual decimals used
   */
  async getAdjustedAvailableBalance(
    derivedAddress: string,
    erc20Address: string,
  ): Promise<{ amount: string; decimals: number }> {
    const unclaimedBalances = await this.fetchUnclaimedBalances(derivedAddress);

    const tokenBalance = unclaimedBalances.find(
      balance =>
        balance.erc20Address.toLowerCase() === erc20Address.toLowerCase(),
    );

    if (!tokenBalance || !tokenBalance.amount || tokenBalance.amount === '0') {
      throw new Error(
        `No ${erc20Address} tokens available in the derived address`,
      );
    }

    // Apply random subtraction to work around contract constraints
    const balance = BigInt(tokenBalance.amount);
    const randomSubtraction = BigInt(Math.floor(Math.random() * 1000) + 1);
    const adjustedBalance = balance - randomSubtraction;

    // Ensure we don't go negative
    const finalBalance =
      adjustedBalance > BigInt(0) ? adjustedBalance : BigInt(1);

    // Convert to decimal format using the actual contract decimals
    const balanceInUnits = ethers.formatUnits(
      finalBalance,
      tokenBalance.decimals,
    );

    return {
      amount: balanceInUnits,
      decimals: tokenBalance.decimals,
    };
  }

  /**
   * Get available balance for a specific token using public key
   * This is a convenience method that derives the address first
   */
  async getAdjustedAvailableBalanceByPublicKey(
    publicKey: PublicKey,
    erc20Address: string,
    vaultAuthority: PublicKey,
    basePublicKey: string,
  ): Promise<{ amount: string; decimals: number }> {
    // Import here to avoid circular dependency
    const { deriveEthereumAddress } = await import('@/lib/constants/addresses');

    const path = publicKey.toString();
    const derivedAddress = deriveEthereumAddress(
      path,
      vaultAuthority.toString(),
      basePublicKey,
    );

    return this.getAdjustedAvailableBalance(derivedAddress, erc20Address);
  }
}
