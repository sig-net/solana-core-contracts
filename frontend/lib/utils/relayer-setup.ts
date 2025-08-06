import { Connection } from '@solana/web3.js';
import { Keypair } from '@solana/web3.js';
import NodeWallet from '@coral-xyz/anchor/dist/esm/nodewallet.js';
import { ethers } from 'ethers';

import {
  CrossChainOrchestrator,
  type CrossChainConfig,
} from '@/lib/services/cross-chain-orchestrator';
import { getFullEnv } from '@/lib/utils/env';
import {
  getSolanaConnection,
  getEthereumProvider,
} from '@/lib/utils/providers';

export interface RelayerSetup {
  connection: Connection;
  provider: ethers.JsonRpcProvider;
  relayerWallet: NodeWallet;
  orchestrator: CrossChainOrchestrator;
}

export async function initializeRelayerSetup(
  config: CrossChainConfig = {},
): Promise<RelayerSetup> {
  const env = getFullEnv();

  const connection = getSolanaConnection();
  const provider = getEthereumProvider();

  const relayerKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(env.RELAYER_PRIVATE_KEY)),
  );
  const relayerWallet = new NodeWallet(relayerKeypair);

  const orchestrator = new CrossChainOrchestrator(
    connection,
    relayerWallet,
    provider,
    config,
  );

  return {
    connection,
    provider,
    relayerWallet,
    orchestrator,
  };
}
