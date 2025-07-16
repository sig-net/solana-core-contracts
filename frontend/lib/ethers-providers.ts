import { ethers } from 'ethers';
import { BrowserProvider, JsonRpcProvider, Wallet } from 'ethers';

// Sepolia testnet configuration
const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_RPC_URL =
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
  'https://sepolia.infura.io/v3/YOUR_INFURA_KEY';

// Private key for automated transactions (should be in environment variable)
const AUTOMATED_WALLET_PRIVATE_KEY =
  process.env.NEXT_PUBLIC_AUTOMATED_WALLET_PRIVATE_KEY || '';

// Type definitions
export type UserProvider = BrowserProvider | null;
export type AutomatedProvider = JsonRpcProvider;
export type AutomatedWallet = Wallet;

class EthersProviders {
  private static instance: EthersProviders;
  private userProvider: UserProvider = null;
  private automatedProvider: AutomatedProvider;
  private automatedWallet: AutomatedWallet;

  private constructor() {
    // Initialize automated provider (always available)
    this.automatedProvider = new JsonRpcProvider(SEPOLIA_RPC_URL, {
      chainId: SEPOLIA_CHAIN_ID,
      name: 'sepolia',
    });

    // Initialize automated wallet if private key is provided
    if (AUTOMATED_WALLET_PRIVATE_KEY) {
      this.automatedWallet = new Wallet(
        AUTOMATED_WALLET_PRIVATE_KEY,
        this.automatedProvider,
      );
    } else {
      console.warn(
        'No automated wallet private key provided. Automated transactions will not be available.',
      );
      // Create a dummy wallet that will throw if used
      this.automatedWallet = {} as Wallet;
    }
  }

  public static getInstance(): EthersProviders {
    if (!EthersProviders.instance) {
      EthersProviders.instance = new EthersProviders();
    }
    return EthersProviders.instance;
  }

  /**
   * Get or create the user's browser provider (MetaMask, etc.)
   * @returns Promise<BrowserProvider> - The browser provider instance
   */
  public async getUserProvider(): Promise<BrowserProvider> {
    if (!this.userProvider) {
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error(
          'No Ethereum provider found. Please install MetaMask or another wallet.',
        );
      }

      this.userProvider = new BrowserProvider(window.ethereum);

      // Ensure we're on Sepolia
      try {
        const network = await this.userProvider.getNetwork();
        if (network.chainId !== BigInt(SEPOLIA_CHAIN_ID)) {
          // Request to switch to Sepolia
          await this.requestSepoliaNetwork();
        }
      } catch (error) {
        console.error('Error checking network:', error);
      }
    }

    return this.userProvider;
  }

  /**
   * Get the automated provider for read-only operations
   * @returns JsonRpcProvider - The automated provider instance
   */
  public getAutomatedProvider(): AutomatedProvider {
    return this.automatedProvider;
  }

  /**
   * Get the automated wallet for signing transactions
   * @returns Wallet - The automated wallet instance
   */
  public getAutomatedWallet(): AutomatedWallet {
    if (!AUTOMATED_WALLET_PRIVATE_KEY) {
      throw new Error(
        'Automated wallet not configured. Please set NEXT_PUBLIC_AUTOMATED_WALLET_PRIVATE_KEY environment variable.',
      );
    }
    return this.automatedWallet;
  }

  /**
   * Request user to switch to Sepolia network
   */
  private async requestSepoliaNetwork(): Promise<void> {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}` }],
      });
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}`,
                chainName: 'Sepolia Test Network',
                nativeCurrency: {
                  name: 'SepoliaETH',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: [SEPOLIA_RPC_URL],
                blockExplorerUrls: ['https://sepolia.etherscan.io/'],
              },
            ],
          });
        } catch (addError) {
          throw new Error('Failed to add Sepolia network to wallet');
        }
      } else {
        throw switchError;
      }
    }
  }

  /**
   * Request user to connect their wallet
   * @returns Promise<string[]> - Array of connected addresses
   */
  public async requestAccounts(): Promise<string[]> {
    const provider = await this.getUserProvider();
    return await provider.send('eth_requestAccounts', []);
  }

  /**
   * Get the current connected account
   * @returns Promise<string | null> - The connected address or null
   */
  public async getConnectedAccount(): Promise<string | null> {
    try {
      const provider = await this.getUserProvider();
      const accounts = await provider.send('eth_accounts', []);
      return accounts.length > 0 ? accounts[0] : null;
    } catch {
      return null;
    }
  }

  /**
   * Reset the user provider (useful when switching accounts)
   */
  public resetUserProvider(): void {
    this.userProvider = null;
  }
}

// Export singleton instance methods
const providersInstance = EthersProviders.getInstance();

export const getUserProvider = () => providersInstance.getUserProvider();
export const getAutomatedProvider = () =>
  providersInstance.getAutomatedProvider();
export const getAutomatedWallet = () => providersInstance.getAutomatedWallet();
export const requestAccounts = () => providersInstance.requestAccounts();
export const getConnectedAccount = () =>
  providersInstance.getConnectedAccount();
export const resetUserProvider = () => providersInstance.resetUserProvider();

// Export the instance for advanced use cases
export const ethersProviders = providersInstance;

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: any;
  }
}
