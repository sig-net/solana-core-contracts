export function getSepoliaRpcUrl(): string {
  const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  const customRpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;

  if (customRpcUrl) {
    return customRpcUrl;
  }

  if (alchemyApiKey) {
    return `https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`;
  }

  throw new Error(
    'Either NEXT_PUBLIC_ALCHEMY_API_KEY or NEXT_PUBLIC_SEPOLIA_RPC_URL must be set',
  );
}
