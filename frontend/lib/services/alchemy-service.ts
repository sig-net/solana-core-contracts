import { Alchemy, Network } from 'alchemy-sdk';

// Create singleton Alchemy instance
let alchemyInstance: Alchemy | null = null;

export function getAlchemy(): Alchemy {
  if (!alchemyInstance) {
    alchemyInstance = new Alchemy({
      apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY!,
      network: Network.ETH_SEPOLIA,
    });
  }
  return alchemyInstance;
}

// Export the instance for direct use
export const alchemy = getAlchemy();
