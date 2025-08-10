import { createConfig, http } from 'wagmi';
import { sepolia } from 'wagmi/chains';

import { getSepoliaRpcUrl } from '@/lib/utils/env';

export const wagmiConfig = createConfig({
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(getSepoliaRpcUrl()),
  },
});
