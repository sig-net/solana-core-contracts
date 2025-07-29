import { PublicKey } from '@solana/web3.js';
import { ethers } from 'ethers';
import { erc20Abi } from 'viem';

import type {
  TokenBalance,
  UnclaimedTokenBalance,
} from '@/lib/types/token.types';
import { getPublicClient } from '@/lib/viem/providers';
import { getTokenMetadata } from '@/lib/constants/token-metadata';
import { COMMON_ERC20_ADDRESSES } from '@/lib/constants/ethereum.constants';
import type { BridgeContract } from '@/lib/contracts/bridge-contract';

/**
 * TokenBalanceService handles all token balance operations including
 * fetching and processing ERC20 token balances.
 */
export class TokenBalanceService {
  constructor(private bridgeContract: BridgeContract) {}

  /**
   * Get token decimals from contract
   */
  async getTokenDecimals(erc20Address: string): Promise<number> {
    const provider = getPublicClient();
    try {
      const contractDecimals = await provider.readContract({
        address: erc20Address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'decimals',
      });
      return Number(contractDecimals);
    } catch {
      const tokenMetadata = getTokenMetadata(erc20Address);
      return tokenMetadata?.decimals || 18; // Default to 18 if unknown
    }
  }

  /**
   * Batch fetch ERC20 balances for multiple tokens
   */
  async batchFetchErc20Balances(
    address: string,
    tokenAddresses: string[],
  ): Promise<Array<{ address: string; balance: bigint; decimals: number }>> {
    const provider = getPublicClient();

    const balancePromises = tokenAddresses.map(async tokenAddress => {
      try {
        const balance = await provider.readContract({
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [address as `0x${string}`],
        });
        return { address: tokenAddress, balance: balance as bigint };
      } catch (error) {
        console.error(`Error fetching balance for ${tokenAddress}:`, error);
        return { address: tokenAddress, balance: BigInt(0) };
      }
    });

    const balanceResults = await Promise.all(balancePromises);

    // Only fetch decimals for tokens with non-zero balances
    const nonZeroBalances = balanceResults.filter(
      result => result.balance > BigInt(0),
    );
    const decimalsPromises = nonZeroBalances.map(async result => {
      const decimals = await this.getTokenDecimals(result.address);
      return { ...result, decimals };
    });

    const finalResults = await Promise.all(decimalsPromises);

    // Include zero balances with default decimals for completeness
    const zeroBalances = balanceResults
      .filter(result => result.balance === BigInt(0))
      .map(result => ({ ...result, decimals: 18 })); // Default decimals for zero balances

    return [...finalResults, ...zeroBalances];
  }

  /**
   * Fetch unclaimed balances from derived Ethereum address
   */
  async fetchUnclaimedBalances(
    derivedAddress: string,
  ): Promise<UnclaimedTokenBalance[]> {
    try {
      const commonErc20Addresses = [...COMMON_ERC20_ADDRESSES] as string[];

      // Use batch fetching to reduce RPC calls
      const batchResults = await this.batchFetchErc20Balances(
        derivedAddress,
        commonErc20Addresses,
      );

      const results: UnclaimedTokenBalance[] = [];

      for (const result of batchResults) {
        if (result.balance > BigInt(0)) {
          const tokenMetadata = getTokenMetadata(result.address);
          results.push({
            erc20Address: result.address,
            amount: result.balance.toString(),
            symbol: tokenMetadata?.symbol || 'Unknown',
            name: tokenMetadata?.name || 'Unknown Token',
            decimals: result.decimals,
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
      const commonErc20Addresses = [...COMMON_ERC20_ADDRESSES] as string[];

      const balancesPromises = commonErc20Addresses.map(async erc20Address => {
        const balance = await this.bridgeContract.fetchUserBalance(
          publicKey,
          erc20Address,
        );
        if (balance !== '0') {
          const decimals = await this.getTokenDecimals(erc20Address);
          return {
            erc20Address,
            amount: balance,
            decimals,
          };
        }
        return null;
      });

      const results = await Promise.all(balancesPromises);
      return results.filter(result => result !== null);
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
    const { CryptographyService } = await import(
      '@/lib/services/cryptography-service'
    );

    const path = publicKey.toString();
    const derivedAddress = CryptographyService.deriveEthereumAddress(
      path,
      vaultAuthority.toString(),
      basePublicKey,
    );

    return this.getAdjustedAvailableBalance(derivedAddress, erc20Address);
  }
}
