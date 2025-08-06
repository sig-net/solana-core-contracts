import { ethers } from 'ethers';
import { Connection } from '@solana/web3.js';
import { Alchemy, Network } from 'alchemy-sdk';

import { getClientEnv, getSepoliaRpcUrl, getSolanaRpcUrl } from './env';

export type SupportedChain = 'ethereum-sepolia' | 'solana';

export function getEthereumProvider(): ethers.JsonRpcProvider {
  const rpcUrl = getSepoliaRpcUrl();
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  return provider;
}

export function getSolanaConnection(): Connection {
  const rpcUrl = getSolanaRpcUrl();
  const connection = new Connection(rpcUrl);

  return connection;
}

export function getAlchemyProvider(): Alchemy {
  const env = getClientEnv();
  const alchemy = new Alchemy({
    apiKey: env.NEXT_PUBLIC_ALCHEMY_API_KEY,
    network: Network.ETH_SEPOLIA,
  });

  return alchemy;
}
