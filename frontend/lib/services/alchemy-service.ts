import { Alchemy, BigNumber, Network } from 'alchemy-sdk';

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
}

/**
 * AlchemyService provides a centralized way to interact with Alchemy SDK
 * for all Ethereum operations including balance fetching, gas estimation, etc.
 */
export class AlchemyService {
  private static instance: Alchemy | null = null;
  private static readonly DEFAULT_RETRY_OPTIONS: RetryOptions = {
    maxRetries: 5,
    baseDelay: 1000, // 1 second
    maxDelay: 32000, // 32 seconds
  };

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
   * Generic retry wrapper with exponential backoff for API calls
   */
  private static async withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {},
  ): Promise<T> {
    const { maxRetries, baseDelay, maxDelay } = {
      ...AlchemyService.DEFAULT_RETRY_OPTIONS,
      ...options,
    };

    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries!; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Check if this is a rate limit error (429)
        const isRateLimit =
          error instanceof Error &&
          (error.message.includes('429') ||
            error.message.includes('rate limit') ||
            error.message.includes('too many requests'));

        // Don't retry on non-retryable errors unless it's a rate limit
        if (
          attempt === maxRetries ||
          (!isRateLimit && !this.isRetryableError(error))
        ) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(baseDelay! * Math.pow(2, attempt), maxDelay!);

        // Add jitter to prevent thundering herd
        const jitteredDelay = delay + Math.random() * 1000;

        console.warn(
          `[AlchemyService] Attempt ${attempt + 1}/${maxRetries! + 1} failed, retrying in ${Math.round(jitteredDelay)}ms:`,
          error.message,
        );

        await new Promise(resolve => setTimeout(resolve, jitteredDelay));
      }
    }

    throw lastError!;
  }

  /**
   * Check if an error is retryable
   */
  private static isRetryableError(error: any): boolean {
    if (typeof error === 'object' && error !== null) {
      // Network errors
      if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') {
        return true;
      }

      // HTTP status codes that are retryable
      if (error.status >= 500 || error.status === 429) {
        return true;
      }
    }

    // String-based error detection
    const errorMessage = error?.message?.toLowerCase() || '';
    return (
      errorMessage.includes('timeout') ||
      errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('econnreset') ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('429')
    );
  }

  /**
   * Get token balance using Alchemy SDK
   * Uses getTokenBalances with single token address since getTokenBalance doesn't exist
   */
  static async getTokenBalance(
    address: string,
    tokenAddress: string,
    alchemy?: Alchemy,
  ): Promise<string | null> {
    const instance = alchemy || AlchemyService.getInstance();
    return AlchemyService.withRetry(async () => {
      try {
        // Use getTokenBalances with single token address array
        const result = await instance.core.getTokenBalances(address, [
          tokenAddress,
        ]);

        if (result && result.tokenBalances && result.tokenBalances.length > 0) {
          const tokenBalance = result.tokenBalances[0];

          // Check if it's a successful balance result (not an error)
          if (
            'tokenBalance' in tokenBalance &&
            tokenBalance.tokenBalance !== null
          ) {
            return tokenBalance.tokenBalance;
          }
        }

        return '0'; // Return '0' if no balance found or error
      } catch (error) {
        console.error('Error fetching token balance:', error);
        return null;
      }
    });
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
    return AlchemyService.withRetry(async () => {
      try {
        return await instance.core.getTokenBalances(address, tokenAddresses);
      } catch (error) {
        console.error('Error fetching token balances:', error);
        return null;
      }
    });
  }

  /**
   * Get token metadata using Alchemy SDK
   */
  static async getTokenMetadata(tokenAddress: string, alchemy?: Alchemy) {
    const instance = alchemy || AlchemyService.getInstance();
    return AlchemyService.withRetry(async () => {
      try {
        return await instance.core.getTokenMetadata(tokenAddress);
      } catch (error) {
        console.error('Error fetching token metadata:', error);
        return null;
      }
    });
  }

  /**
   * Get transaction count (nonce)
   */
  static async getTransactionCount(
    address: string,
    alchemy?: Alchemy,
  ): Promise<number> {
    const instance = alchemy || AlchemyService.getInstance();
    return AlchemyService.withRetry(async () => {
      return await instance.core.getTransactionCount(address);
    });
  }

  /**
   * Get fee data for transactions
   */
  static async getFeeData(alchemy?: Alchemy) {
    const instance = alchemy || AlchemyService.getInstance();
    return AlchemyService.withRetry(async () => {
      return await instance.core.getFeeData();
    });
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
  ): Promise<BigNumber> {
    const instance = alchemy || AlchemyService.getInstance();
    return AlchemyService.withRetry(async () => {
      return await instance.core.estimateGas(transaction);
    });
  }
}
