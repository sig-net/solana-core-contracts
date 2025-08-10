'use client';

import { useState } from 'react';

import type {
  NetworkData,
  TokenMetadata,
} from '@/lib/constants/token-metadata';
import { getAllNetworks } from '@/lib/constants/token-metadata';

import { NetworkAccordionItem } from './network-accordion-item';

interface TokenSelectionProps {
  onTokenSelect: (token: TokenMetadata, network: NetworkData) => void;
}

export function TokenSelection({ onTokenSelect }: TokenSelectionProps) {
  const [expandedNetworkId, setExpandedNetworkId] = useState<string | null>(
    null,
  );

  const networks = getAllNetworks();

  const handleNetworkClick = (networkId: string) => {
    setExpandedNetworkId(expandedNetworkId === networkId ? null : networkId);
  };

  const handleTokenSelect = (token: TokenMetadata, network: NetworkData) => {
    onTokenSelect(token, network);
    setExpandedNetworkId(null); // Collapse after selection
  };

  return (
    <div className='space-y-3'>
      <p className='text-wf-base-700 text-sm font-medium tracking-wider uppercase'>
        Select Network
      </p>

      {/* Network Accordion List */}
      <div className='max-h-96 space-y-3 overflow-y-auto'>
        {networks.map(network => {
          const networkId = network.chain;
          const isExpanded = expandedNetworkId === networkId;

          return (
            <NetworkAccordionItem
              key={networkId}
              network={network}
              isExpanded={isExpanded}
              onNetworkClick={() => handleNetworkClick(networkId)}
              onTokenSelect={handleTokenSelect}
            />
          );
        })}
      </div>
    </div>
  );
}
