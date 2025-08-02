import { Alchemy, Network } from 'alchemy-sdk';

/**
 * AlchemyService provides a centralized way to interact with Alchemy SDK
 * for all Ethereum operations including balance fetching, gas estimation, etc.
 */
export class AlchemyService {
  private static instance: Alchemy | null = null;

  /**
   * Get singleton Alchemy instance
   */
  static getInstance(): Alchemy {
    if (!AlchemyService.instance) {
      AlchemyService.instance = new Alchemy({
        apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY!,
        network: Network.ETH_SEPOLIA,
      });
    }
    return AlchemyService.instance;
  }

  /**
   * Create a new Alchemy instance (useful for testing or different configs)
   */
  static createInstance(apiKey?: string, network?: Network): Alchemy {
    return new Alchemy({
      apiKey: apiKey || process.env.NEXT_PUBLIC_ALCHEMY_API_KEY!,
      network: network || Network.ETH_SEPOLIA,
    });
  }

  /**
   * Get token balance using Alchemy SDK
   */
  static async getTokenBalance(
    address: string,
    tokenAddress: string,
    alchemy?: Alchemy,
  ): Promise<string | null> {
    const instance = alchemy || AlchemyService.getInstance();
    try {
      return await instance.core.getTokenBalance(address, tokenAddress);
    } catch (error) {
      console.error('Error fetching token balance:', error);
      return null;
    }
  }

  /**
   * Get multiple token balances efficiently
   */
  static async getTokenBalances(
    address: string,
    tokenAddresses: string[],
    alchemy?: Alchemy,
  ) {
    const instance = alchemy || AlchemyService.getInstance();
    try {
      return await instance.core.getTokenBalances(address, tokenAddresses);
    } catch (error) {
      console.error('Error fetching token balances:', error);
      return null;
    }
  }

  /**
   * Get token metadata using Alchemy SDK
   */
  static async getTokenMetadata(
    tokenAddress: string,
    alchemy?: Alchemy,
  ) {
    const instance = alchemy || AlchemyService.getInstance();
    try {
      return await instance.core.getTokenMetadata(tokenAddress);
    } catch (error) {
      console.error('Error fetching token metadata:', error);
      return null;
    }
  }

  /**
   * Get transaction count (nonce)
   */
  static async getTransactionCount(
    address: string,
    alchemy?: Alchemy,
  ): Promise<number> {
    const instance = alchemy || AlchemyService.getInstance();
    return await instance.core.getTransactionCount(address);
  }

  /**
   * Get fee data for transactions
   */
  static async getFeeData(alchemy?: Alchemy) {
    const instance = alchemy || AlchemyService.getInstance();
    return await instance.core.getFeeData();
  }

  /**
   * Estimate gas for a transaction
   */
  static async estimateGas(
    transaction: {
      to?: string;
      from?: string;
      data?: string;
      value?: number | string;
    },
    alchemy?: Alchemy,
  ): Promise<string> {
    const instance = alchemy || AlchemyService.getInstance();
    return await instance.core.estimateGas(transaction);
  }
}